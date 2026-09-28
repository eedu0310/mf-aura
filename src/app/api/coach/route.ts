import { NextResponse } from "next/server";
import type OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOpenAIClient } from "@/lib/openai-client";
import { AURA_COACH_SYSTEM_PROMPT, PERSONA_GESTOR } from "@/lib/aura-coach-prompt";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { registrarFalhaIA } from "@/lib/aura/custo-ia";
import { textoDosMateriais } from "@/lib/aura/materiais";
import {
  ferramentasParaResponsesAPI,
  executarFerramenta,
} from "@/lib/aura-tools";

export const runtime = "nodejs";

interface MensagemEntrada {
  autor: "usuario" | "aura";
  texto: string;
}

interface CtxExecucao {
  supabase: SupabaseClient;
  empresa: string;
  userId: string;
}

function montarSystemPrompt(
  playbook?: string,
  contextoDados?: string,
  permiteAcoes?: boolean,
  cargo?: string,
  materiais?: string,
) {
  let prompt = AURA_COACH_SYSTEM_PROMPT;

  if (cargo === "Gestor") {
    prompt += `\n\n${PERSONA_GESTOR}`;
  }

  if (permiteAcoes) {
    prompt += `\n\nVocê tem ferramentas reais disponíveis: criar_compromisso (agendar algo na agenda), atualizar_proximo_contato (atualizar CRM), criar_relacionamento (cadastrar um novo cliente/contato), registrar_atividade (catalogar uma atividade já realizada, a partir do relato do vendedor), atualizar_oportunidade (alterar etapa ou probabilidade de uma oportunidade somente com confirmação explícita do vendedor), concluir_compromisso (marcar um compromisso da agenda como concluído), atualizar_status_pos_venda (mudar o status de instalação de uma venda: agendada, realizada, pendente, reclamação, concluído) e registrar_avaliacao_cliente (registrar a nota que um cliente deu à loja). Quando o vendedor pedir para agendar, marcar, lembrar, atualizar o CRM, cadastrar um contato novo, contar o que já fez, atualizar uma oportunidade ou concluir um compromisso, USE a ferramenta correspondente para executar de verdade — não apenas diga que a pessoa deveria fazer isso. Não use nenhuma ferramenta relacionada a WhatsApp nesta etapa. Depois de executar, confirme em uma frase curta o que foi feito.`;
  }

  if (playbook && playbook.trim()) {
    prompt += `\n\nMANUAL DE VENDAS DA EMPRESA (siga este processo como referência prioritária, acima de conhecimento genérico de vendas):\n"""\n${playbook.trim()}\n"""`;
  }

  // Materiais que o gestor enviou na Visão do Gestor ("Materiais que a AURA
  // estuda"): regras da casa, tabela de produtos, scripts. Valem mais que
  // conhecimento genérico de vendas.
  if (materiais && materiais.trim()) {
    prompt += `\n\nMATERIAIS DA EMPRESA (regras da casa, produtos, scripts — responda com base nisto quando a pergunta for sobre política interna, prazo, desconto ou produto):\n"""\n${materiais.trim()}\n"""`;
  }

  if (contextoDados) {
    prompt += `\n\nDados reais e atuais deste vendedor (use-os para responder de forma específica, não genérica):\n${contextoDados}`;
  }

  return prompt;
}

/** Remove marcação markdown residual (**, ##, etc.), caso a IA a use mesmo com a instrução em contrário. */
function limparMarkdown(texto: string) {
  return texto
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/`([^`]*)`/g, "$1");
}

/**
 * Gera a resposta da IA. Se houver um vector store (documentos enviados na
 * base de conhecimento), usa a Responses API com "file_search". Se houver
 * um usuário autenticado (ctx), também disponibiliza ferramentas que a IA
 * pode executar de verdade (criar compromisso, atualizar CRM). Caso
 * contrário, usa a Chat Completions normal.
 */
async function perguntarIA({
  openai,
  systemPrompt,
  mensagens,
  vectorStoreId,
  ctx,
  temperature = 0.6,
}: {
  openai: OpenAI;
  systemPrompt: string;
  mensagens: { role: "user" | "assistant"; content: string }[];
  vectorStoreId?: string | null;
  ctx?: CtxExecucao | null;
  temperature?: number;
}): Promise<string> {
  if (vectorStoreId || ctx) {
    const tools: Array<Record<string, unknown>> = [];
    if (vectorStoreId) tools.push({ type: "file_search", vector_store_ids: [vectorStoreId] });
    if (ctx) tools.push(...ferramentasParaResponsesAPI());

    const inputInicial = mensagens.map((m) => ({ role: m.role, content: m.content }));

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      instructions: systemPrompt,
      input: inputInicial,
      tools: tools as never,
      temperature,
    }, { __funcao: "coach" } as never);

    const chamadasFuncao = (response.output ?? []).filter(
      (item): item is Extract<(typeof response.output)[number], { type: "function_call" }> =>
        item.type === "function_call"
    );

    if (chamadasFuncao.length > 0 && ctx) {
      const resultados = await Promise.all(
        chamadasFuncao.map(async (chamada) => ({
          type: "function_call_output" as const,
          call_id: chamada.call_id,
          output: await executarFerramenta(chamada.name, chamada.arguments, ctx),
        }))
      );

      const segundaResposta = await openai.responses.create({
        model: "gpt-4o-mini",
        instructions: systemPrompt,
        input: [...inputInicial, ...response.output, ...resultados] as never,
        tools: tools as never,
        temperature,
      }, { __funcao: "coach" } as never);

      return limparMarkdown(segundaResposta.output_text ?? "Ação realizada.");
    }

    return limparMarkdown(response.output_text ?? "Não consegui responder agora.");
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: systemPrompt }, ...mensagens] as never,
    temperature,
  }, { __funcao: "coach" } as never);

  return limparMarkdown(completion.choices[0]?.message?.content ?? "Não consegui responder agora.");
}

export async function POST(request: Request) {
  const body = await request.json();
  const modo: "chat" | "analise_reuniao" | "preparar_reuniao" = body.modo ?? "chat";
  const openai = getOpenAIClient();

  // Busca, no servidor, quem está autenticado, a empresa, e se essa
  // empresa já tem documentos indexados (base de conhecimento). Isso é
  // o que ativa tanto o File Search quanto as ferramentas de ação real.
  let vectorStoreId: string | null = null;
  const auth = await getEmpresaAutenticada();
  if (auth) {
    const { data } = await auth.supabase
      .from("playbook")
      .select("vector_store_id")
      .eq("empresa", auth.empresa)
      .maybeSingle();
    vectorStoreId = (data?.vector_store_id as string) ?? null;
  }

  // Biblioteca de materiais da empresa (o gestor envia na Visão do Gestor).
  let materiais = "";
  if (auth) {
    try {
      materiais = await textoDosMateriais(auth.supabase, auth.empresa);
    } catch (e) {
      console.error("[coach] materiais da empresa:", e);
    }
  }

  if (!auth) {
    return NextResponse.json(
      { erro: "É necessário estar autenticado para usar a AURA com dados reais." },
      { status: 401 },
    );
  }

  if (modo === "preparar_reuniao") {
    const equipe = body.equipe ?? [];

    if (!openai) return NextResponse.json({ erro: "AURA IA não configurada." }, { status: 503 });

    try {
      const resumoEquipe = equipe
        .map(
          (v: { nome: string; vendas: number; atividades7dias: number; tendencia: string }) =>
            `- ${v.nome}: vendas R$ ${v.vendas}, ${v.atividades7dias} atividades nos últimos 7 dias, tendência: ${v.tendencia}`
        )
        .join("\n");

      const resposta = await perguntarIA({
        openai,
        systemPrompt: montarSystemPrompt(body.playbook, undefined, false, auth?.cargo, materiais),
        mensagens: [
          {
            role: "user",
            content: `Prepare a pauta da reunião semanal de segunda-feira com esta equipe de vendas, seguindo a estrutura Reconhecer → Aprender → Desenvolver → Comprometer. Seja específico usando os dados abaixo, mas sem inventar números que não foram informados.\n\nEquipe:\n${resumoEquipe}`,
          },
        ],
        vectorStoreId,
        temperature: 0.5,
      });

      return NextResponse.json({ resposta, simulado: false });
    } catch (err) {
      console.error("Erro ao chamar OpenAI (preparar reunião):", err);
      return NextResponse.json({ erro: "Não foi possível preparar a reunião com os dados reais." }, { status: 502 });
    }
  }

  if (modo === "analise_reuniao") {
    const transcricao: string = body.transcricao ?? "";

    if (!openai) return NextResponse.json({ erro: "AURA IA não configurada." }, { status: 503 });

    try {
      const resposta = await perguntarIA({
        openai,
        systemPrompt: montarSystemPrompt(body.playbook, undefined, false, auth?.cargo, materiais),
        mensagens: [
          {
            role: "user",
            content: `Aqui está a transcrição de uma reunião/visita com um cliente. Analise conforme suas instruções.\n\nTranscrição:\n"""\n${transcricao}\n"""`,
          },
        ],
        vectorStoreId,
        temperature: 0.5,
      });

      return NextResponse.json({ resposta, simulado: false });
    } catch (err) {
      console.error("Erro ao chamar OpenAI (análise de reunião):", err);
      return NextResponse.json({ erro: "Não foi possível analisar a reunião com os dados reais." }, { status: 502 });
    }
  }

  // modo: chat
  const mensagens: MensagemEntrada[] = body.mensagens ?? [];
  const contextoDados: string | undefined = body.contexto;

  if (!Array.isArray(mensagens) || mensagens.length === 0 || mensagens.length > 40) {
    return NextResponse.json({ erro: "Histórico de conversa inválido." }, { status: 400 });
  }

  if (typeof contextoDados !== "string" || contextoDados.trim().length < 40 || contextoDados.length > 100_000) {
    return NextResponse.json({ erro: "Contexto real da aplicação ausente ou inválido." }, { status: 400 });
  }

  const mensagensValidas = mensagens.every(
    (mensagem) =>
      (mensagem.autor === "usuario" || mensagem.autor === "aura") &&
      typeof mensagem.texto === "string" &&
      mensagem.texto.trim().length > 0 &&
      mensagem.texto.length <= 8_000,
  );
  if (!mensagensValidas) {
    return NextResponse.json({ erro: "Mensagem inválida." }, { status: 400 });
  }

  if (!openai) return NextResponse.json({ erro: "AURA IA não configurada." }, { status: 503 });

  try {
    const ctx: CtxExecucao = { supabase: auth.supabase, empresa: auth.empresa, userId: auth.userId };

    const resposta = await perguntarIA({
      openai,
      systemPrompt: montarSystemPrompt(body.playbook, contextoDados, Boolean(ctx), auth?.cargo, materiais),
      mensagens: mensagens.map((m) => ({
        role: m.autor === "usuario" ? "user" : "assistant",
        content: m.texto,
      })),
      vectorStoreId,
      ctx,
    });

    return NextResponse.json({ resposta, simulado: false, usandoDocumentos: Boolean(vectorStoreId) });
  } catch (err: any) {
    const detalhe = err?.message ?? String(err);
    console.error("[coach] falha ao responder:", detalhe, err);
    // Antes isto ia para um arquivo dentro do servidor, que ninguem abre.
    // No banco o gestor ve o motivo em Custo da IA, e eu tambem.
    await registrarFalhaIA({
      funcao: "coach",
      erro: err,
      empresa: auth.empresa,
      usuarioId: auth.userId,
      detalhe: { mensagens: mensagens.length, tamanhoContexto: contextoDados.length },
    });
    return NextResponse.json(
      { erro: `Não consegui responder agora: ${detalhe}` },
      { status: 502 },
    );
  }
}
