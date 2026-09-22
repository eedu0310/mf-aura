import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { getOpenAIClient } from "@/lib/openai-client";
import { enviarMensagemWhatsApp } from "@/lib/whatsapp";
import { NOMES_EMPRESAS } from "@/lib/companies";

export const runtime = "nodejs";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

function empresaPorPhoneNumberId(phoneNumberId: string): string | null {
  try {
    const mapa = JSON.parse(process.env.WHATSAPP_NUMEROS ?? "{}");
    return mapa[phoneNumberId] ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ erro: "Verificação falhou." }, { status: 403 });
}

export async function POST(request: Request) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json({ erro: "Supabase não configurado." }, { status: 500 });
  }

  const body = await request.json();

  try {
    const entradas = body.entry ?? [];
    for (const entrada of entradas) {
      for (const mudanca of entrada.changes ?? []) {
        const valor = mudanca.value;
        const phoneNumberId = valor?.metadata?.phone_number_id;
        const mensagens = valor?.messages ?? [];

        if (!phoneNumberId || mensagens.length === 0) continue;

        const empresa = empresaPorPhoneNumberId(phoneNumberId);
        if (!empresa || !NOMES_EMPRESAS.includes(empresa)) {
          console.error("Nenhuma empresa mapeada para o phone_number_id:", phoneNumberId);
          continue;
        }

        for (const msg of mensagens) {
          const telefone: string = msg.from;
          const nomeContato: string | undefined = valor.contacts?.[0]?.profile?.name;
          const texto: string = msg.text?.body ?? "[mensagem sem texto — mídia, botão ou outro tipo]";

          await processarMensagemRecebida(supabase, {
            empresa,
            telefone,
            nome: nomeContato,
            mensagem: texto,
            phoneNumberId,
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Erro ao processar webhook do WhatsApp:", err);
    return NextResponse.json({ ok: true });
  }
}

async function processarMensagemRecebida(
  supabase: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
  {
    empresa,
    telefone,
    nome,
    mensagem,
    phoneNumberId,
  }: { empresa: string; telefone: string; nome?: string; mensagem: string; phoneNumberId: string }
) {
  const { data: conversaExistente } = await supabase
    .from("whatsapp_conversas")
    .select("*")
    .eq("empresa", empresa)
    .eq("telefone", telefone)
    .neq("status", "encerrada")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let conversaId = conversaExistente?.id as string | undefined;
  let iaAtiva = conversaExistente?.ia_ativa ?? true;

  if (!conversaId) {
    const { data: novaConversa, error: erroConversa } = await supabase
      .from("whatsapp_conversas")
      .insert({
        empresa,
        telefone,
        nome_cliente: nome?.trim() || null,
        phone_number_id: phoneNumberId,
        status: "aguardando_aceite",
        ia_ativa: true,
      })
      .select("id")
      .single();

    if (erroConversa || !novaConversa) {
      console.error("Erro ao criar conversa:", erroConversa);
      return;
    }
    conversaId = novaConversa.id;
    iaAtiva = true;
  }

  await supabase.from("whatsapp_mensagens").insert({
    conversa_id: conversaId,
    remetente: "cliente",
    texto: mensagem,
  });

  if (!iaAtiva) return;

  if (!conversaId) return;

  await processarFluxoDeLead(supabase, { empresa, telefone, nome, mensagem, phoneNumberId, conversaId });
}

async function processarFluxoDeLead(
  supabase: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
  {
    empresa,
    telefone,
    nome,
    mensagem,
    phoneNumberId,
    conversaId,
  }: { empresa: string; telefone: string; nome?: string; mensagem: string; phoneNumberId: string; conversaId: string }
) {
  const { data: leadAberto } = await supabase
    .from("leads_recebidos")
    .select("*")
    .eq("empresa", empresa)
    .eq("telefone", telefone)
    .eq("qualificacao_concluida", false)
    .not("status", "in", "(respondido,perdido)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const perguntas = await buscarPerguntasQualificacao(supabase, empresa);

  if (leadAberto) {
    const perguntaAtual = perguntas[leadAberto.etapa_qualificacao];
    const respostas = [
      ...(Array.isArray(leadAberto.respostas_qualificacao) ? leadAberto.respostas_qualificacao : []),
    ];
    if (perguntaAtual) {
      respostas.push({ pergunta: perguntaAtual.pergunta, resposta: mensagem });
    }

    const proximaEtapa = leadAberto.etapa_qualificacao + 1;
    const proximaPergunta = perguntas[proximaEtapa];

    if (proximaPergunta) {
      await supabase
        .from("leads_recebidos")
        .update({ respostas_qualificacao: respostas, etapa_qualificacao: proximaEtapa })
        .eq("id", leadAberto.id);
      const mensagemHumanizada = await gerarMensagemQualificacao(supabase, {
        empresa,
        historico: respostas,
        proximaPergunta: proximaPergunta.pergunta,
      });
      await enviarEGravar(supabase, phoneNumberId, telefone, conversaId, mensagemHumanizada);
    } else {
      await supabase
        .from("leads_recebidos")
        .update({ respostas_qualificacao: respostas, qualificacao_concluida: true })
        .eq("id", leadAberto.id);
      await supabase.from("whatsapp_conversas").update({ lead_id: leadAberto.id }).eq("id", conversaId);
      await supabase.rpc("distribuir_lead_novo", { p_lead_id: leadAberto.id });
      const mensagemFinal = await gerarMensagemQualificacao(supabase, {
        empresa,
        historico: respostas,
        proximaPergunta: null,
      });
      await enviarEGravar(supabase, phoneNumberId, telefone, conversaId, mensagemFinal);
    }
    return;
  }

  const { data: existente } = await supabase
    .from("relacionamentos")
    .select("id")
    .eq("empresa", empresa)
    .eq("telefone", telefone)
    .maybeSingle();

  let relacionamentoId = existente?.id as string | undefined;

  if (!relacionamentoId) {
    const { data: criado, error: erroRelacionamento } = await supabase
      .from("relacionamentos")
      .insert({
        empresa,
        nome: nome?.trim() || `Lead WhatsApp ${telefone}`,
        categoria: "Cliente Final",
        cidade: "Não informado",
        telefone,
        temperatura: "quente",
        ultimo_contato: "hoje",
        proximo_contato: "hoje",
        observacao: "Lead recebido automaticamente via WhatsApp.",
        obras_indicadas: 0,
        valor_gerado: 0,
      })
      .select("id")
      .single();

    if (erroRelacionamento) {
      console.error("Erro ao criar relacionamento do lead:", erroRelacionamento);
    } else {
      relacionamentoId = criado?.id;
    }
  }

  const classificacao = await classificarLead(mensagem);
  const temPerguntas = perguntas.length > 0;

  const { data: lead, error: erroLead } = await supabase
    .from("leads_recebidos")
    .insert({
      empresa,
      nome: nome?.trim() || null,
      telefone,
      mensagem_inicial: mensagem,
      origem: "WhatsApp",
      relacionamento_id: relacionamentoId ?? null,
      classificacao: classificacao.classificacao,
      urgencia: classificacao.urgencia,
      resumo_ia: classificacao.resumo,
      qualificacao_concluida: classificacao.classificacao === "spam" ? true : !temPerguntas,
    })
    .select("id")
    .single();

  if (erroLead || !lead) {
    console.error("Erro ao criar lead:", erroLead);
    return;
  }

  await supabase.from("whatsapp_conversas").update({ lead_id: lead.id }).eq("id", conversaId);

  if (classificacao.classificacao === "spam") return;

  if (temPerguntas) {
    const mensagemInicial = await gerarMensagemQualificacao(supabase, {
      empresa,
      historico: [],
      proximaPergunta: perguntas[0].pergunta,
      primeiraMensagemCliente: mensagem,
    });
    await enviarEGravar(supabase, phoneNumberId, telefone, conversaId, mensagemInicial);
    return;
  }

  await supabase.rpc("distribuir_lead_novo", { p_lead_id: lead.id });
  const respostaAutomatica = await gerarRespostaAutomatica(supabase, empresa, mensagem);
  await enviarEGravar(supabase, phoneNumberId, telefone, conversaId, respostaAutomatica);
}

async function enviarEGravar(
  supabase: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
  phoneNumberId: string,
  telefone: string,
  conversaId: string,
  texto: string
) {
  await enviarMensagemWhatsApp(phoneNumberId, telefone, texto);
  await supabase.from("whatsapp_mensagens").insert({
    conversa_id: conversaId,
    remetente: "ia",
    texto,
  });
}

async function buscarPerguntasQualificacao(
  supabase: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
  empresa: string
): Promise<{ pergunta: string }[]> {
  const { data } = await supabase
    .from("perguntas_qualificacao")
    .select("pergunta")
    .eq("empresa", empresa)
    .order("ordem", { ascending: true });
  return data ?? [];
}

async function gerarMensagemQualificacao(
  supabase: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
  {
    empresa,
    historico,
    proximaPergunta,
    primeiraMensagemCliente,
  }: {
    empresa: string;
    historico: { pergunta: string; resposta: string }[];
    proximaPergunta: string | null;
    primeiraMensagemCliente?: string;
  }
): Promise<string> {
  const padrao = proximaPergunta
    ? proximaPergunta
    : "Perfeito, obrigado pelas informações! Já te encaminhei pra um especialista da nossa equipe, ele te chama por aqui em instantes. 😊";

  const openai = getOpenAIClient();
  if (!openai) return padrao;

  try {
    const { data: playbook } = await supabase
      .from("playbook")
      .select("conteudo")
      .eq("empresa", empresa)
      .maybeSingle();

    const systemPrompt = `Você é uma atendente humana da ${empresa}, conversando pelo WhatsApp com um cliente que acabou de chegar. Seu jeito é caloroso, natural e direto — NUNCA robótico, nunca lista numerada, nunca parece um formulário. Escreve como uma pessoa de verdade digitaria no celular: frases curtas, pode usar 1 emoji leve se combinar, sem formalidade excessiva.

Seu objetivo agora é continuar a conversa naturalmente. ${
      proximaPergunta
        ? `Você precisa descobrir a seguinte informação, mas SEM perguntar isso de forma crua/robótica — encaixe a pergunta na conversa, como alguém interessado de verdade perguntaria: "${proximaPergunta}"`
        : "A qualificação terminou. Agradeça de forma calorosa e avise que um especialista da equipe vai continuar o atendimento em instantes."
    }

Regras importantes:
- Uma mensagem só, curta (1-3 frases).
- Não repita literalmente a pergunta cadastrada palavra por palavra — reformule com naturalidade.
- Nunca invente preços, prazos ou informações técnicas específicas.
- Não use markdown, só texto puro.${
      playbook?.conteudo ? `\n\nManual de vendas e atendimento da empresa:\n${playbook.conteudo}` : ""
    }`;

    const mensagensConversa = [
      { role: "system" as const, content: systemPrompt },
      ...(primeiraMensagemCliente
        ? [{ role: "user" as const, content: primeiraMensagemCliente }]
        : historico.flatMap((h) => [
            { role: "assistant" as const, content: h.pergunta },
            { role: "user" as const, content: h.resposta },
          ])),
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: mensagensConversa,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content?.trim() || padrao;
  } catch (err) {
    console.error("Erro ao gerar mensagem de qualificação:", err);
    return padrao;
  }
}

async function gerarRespostaAutomatica(
  supabase: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
  empresa: string,
  mensagemCliente: string
): Promise<string> {
  const padrao = "Obrigado pelo contato! Recebemos sua mensagem e alguém da nossa equipe vai te responder em instantes. 😊";
  const openai = getOpenAIClient();
  if (!openai) return padrao;

  try {
    const { data: playbook } = await supabase
      .from("playbook")
      .select("conteudo")
      .eq("empresa", empresa)
      .maybeSingle();

    const systemPrompt = `Você é uma atendente humana da ${empresa}, conversando pelo WhatsApp. Seu jeito é caloroso, natural e direto. Escreve como uma pessoa de verdade digitaria no celular, frases curtas (2-3 frases no máximo). Responda a mensagem do cliente. Se não tiver certeza de uma informação específica, diga que um especialista confirma em breve — nunca invente. Não use markdown.${
      playbook?.conteudo ? `\n\nManual de vendas e atendimento:\n${playbook.conteudo}` : ""
    }`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: mensagemCliente },
      ],
    });
    return completion.choices[0]?.message?.content || padrao;
  } catch (err) {
    console.error("Erro ao gerar resposta automática:", err);
    return padrao;
  }
}

interface ClassificacaoLead {
  classificacao: "qualificado" | "duvida" | "spam";
  urgencia: "baixa" | "media" | "alta";
  resumo: string;
}

async function classificarLead(mensagem: string): Promise<ClassificacaoLead> {
  const padrao: ClassificacaoLead = {
    classificacao: "qualificado",
    urgencia: "media",
    resumo: mensagem.slice(0, 120),
  };

  const openai = getOpenAIClient();
  if (!openai) return padrao;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Você classifica mensagens recebidas no WhatsApp de uma loja de lareiras/aquecimento. Responda APENAS com um JSON válido, sem markdown, no formato exato:
{"classificacao": "qualificado" | "duvida" | "spam", "urgencia": "baixa" | "media" | "alta", "resumo": "uma frase curta resumindo o que o cliente quer"}`,
        },
        { role: "user", content: mensagem },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const bruto = completion.choices[0]?.message?.content;
    if (!bruto) return padrao;

    const parsed = JSON.parse(bruto);
    return {
      classificacao: ["qualificado", "duvida", "spam"].includes(parsed.classificacao) ? parsed.classificacao : "qualificado",
      urgencia: ["baixa", "media", "alta"].includes(parsed.urgencia) ? parsed.urgencia : "media",
      resumo: typeof parsed.resumo === "string" ? parsed.resumo.slice(0, 200) : padrao.resumo,
    };
  } catch (err) {
    console.error("Erro ao classificar lead:", err);
    return padrao;
  }
}
