/**
 * Rodada diária de aprendizado: toda noite a AURA relê as conversas do dia e
 * sugere ao gestor o que vale guardar.
 *
 * O laudo de fechamento (aura/fechamento.ts) só aprende quando um negócio é
 * decidido, e a maior parte do que se aprende numa conversa acontece antes:
 * a objeção que apareceu na apresentação, a pergunta que todo cliente faz, a
 * abordagem que fez o cliente mandar a planta. Esta rodada colhe isso.
 *
 * POR QUE AQUI E NÃO NO BANCO: as mensagens do WhatsApp não vão para o
 * Supabase. Vivem na sessão do WhatsApp, na memória deste processo. Por isso a
 * rotina roda dentro do servidor da AURA (o cron chama 127.0.0.1) e só enxerga
 * quem está com o WhatsApp conectado. Conversa de quem estava desconectado
 * fica de fora daquele dia.
 *
 * O QUE ENTRA: conversa de lead (não as marcadas "não é lead" nem as
 * ignoradas) com troca de verdade hoje, dos dois lados. Primeiro as que
 * andaram no funil hoje, depois as com mais troca. Fica de fora o negócio que
 * já tem laudo: aquele já foi aprendido no fechamento.
 *
 * O QUE SAI: nada entra em uso sozinho. Tudo nasce "sugerido" e o gestor
 * aprova em Visão do Gestor → Aprendizado, como no laudo. Um padrão que já
 * existe só soma no contador; um que o gestor recusou não volta.
 *
 * CUSTO: uma chamada de IA por loja por noite, com no máximo
 * MAX_CONVERSAS_POR_LOJA conversas, cada uma cortada nas últimas mensagens.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { connectedUserIds, getMessages, type WaMessage } from "@/lib/whatsapp/live-manager";
import { modeloDeRaciocinio } from "./modelos";
import { podeChamarIA, registrarUsoIA } from "./custo-ia";
import { guardarAprendizado, ligarOrigem, limparCacheAprendizado, textoDoAprendizado, type TipoAprendizado } from "./aprendizado";
import { casosDeSugestoes } from "./resultado-sugestoes";
import { nucleoDoManual } from "./trechos";
import { SEGMENTOS_EM_UMA_LINHA } from "@/lib/companies";

const MAX_CONVERSAS_POR_LOJA = 12;
const MENSAGENS_POR_CONVERSA = 40;
const CARACTERES_POR_MENSAGEM = 400;
const MAX_APRENDIZADOS_POR_LOJA = 8;
/** Troca mínima no dia para valer a leitura: menos que isso é "oi" e "obrigado". */
const MIN_DO_CLIENTE = 2;
const MIN_DO_VENDEDOR = 2;

export interface ResultadoDaLoja {
  empresa: string;
  conversasLidas: number;
  sugeridos: number;
  novos: number;
  pulou?: string;
}

interface Conversa {
  empresa: string;
  ownerId: string;
  chatJid: string;
  oportunidadeId: string | null;
  relacionamentoId: string | null;
  nome: string;
  etapa: string | null;
  andouHoje: boolean;
  trocaHoje: number;
  falas: WaMessage[];
}

/** Meia-noite de hoje em Brasília. O Brasil não tem mais horário de verão. */
export function inicioDoDiaEmBrasilia(agora = new Date()): Date {
  const dia = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
  return new Date(`${dia}T00:00:00-03:00`);
}

function clienteIA(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || "";
  return key ? new Anthropic({ apiKey: key }) : null;
}

const FERRAMENTA = {
  name: "aprendizados_do_dia",
  description: "Entrega o que as conversas do dia ensinam para os próximos atendimentos.",
  input_schema: {
    type: "object" as const,
    properties: {
      aprendizados: {
        type: "array",
        description:
          "Só o que for REUTILIZÁVEL com outros clientes. Nada específico de um cliente (nome, endereço, medida exata, valor de um orçamento). Lista vazia é resposta válida e preferível a encher de obviedade.",
        items: {
          type: "object",
          properties: {
            tipo: { type: "string", enum: ["objecao", "pergunta", "abordagem"] },
            gatilho: {
              type: "string",
              description: "O que o cliente disse ou perguntou (objeção, pergunta) ou a situação (abordagem), em poucas palavras.",
            },
            resposta: {
              type: "string",
              description:
                "Se a conversa mostra uma resposta que funcionou (o cliente avançou: mandou medida, pediu orçamento, marcou visita), escreva essa resposta. Se a resposta dada não funcionou, escreva o que deveria ter sido respondido segundo o manual.",
            },
            funcionou: {
              type: "boolean",
              description: "true quando a resposta escrita é a que o vendedor usou e o cliente avançou.",
            },
            conversas: {
              type: "array",
              items: { type: "integer" },
              description:
                "Números das CONVERSAS (=== CONVERSA N ===) de onde isto saiu. Vazio quando saiu só dos casos de sugestão.",
            },
          },
          required: ["tipo", "gatilho", "resposta", "funcionou", "conversas"],
        },
      },
    },
    required: ["aprendizados"],
  },
};

function transcrever(c: Conversa, i: number): string {
  const linhas = c.falas
    .slice(-MENSAGENS_POR_CONVERSA)
    .map((m) => `${m.fromMe ? "VENDEDOR" : "CLIENTE"}: ${m.text.trim().slice(0, CARACTERES_POR_MENSAGEM)}`)
    .join("\n");
  const etapa = c.etapa ? ` · etapa: ${c.etapa}${c.andouHoje ? " (avançou hoje)" : ""}` : "";
  return `=== CONVERSA ${i + 1}${etapa} ===\n${linhas}`;
}

/** Conversas de hoje, por loja, já na ordem de prioridade e cortadas no teto. */
async function conversasDoDia(sb: SupabaseClient, inicio: Date): Promise<Map<string, Conversa[]>> {
  const porLoja = new Map<string, Conversa[]>();
  const donos = connectedUserIds();
  if (!donos.length) return porLoja;

  const { data: linhas } = await sb
    .from("whatsapp_ia_leads")
    .select("owner_id, empresa, chat_jid, nome, etapa, natureza, ignorado, oportunidade_id, relacionamento_id, carteira_relacionamento_id, historico")
    .in("owner_id", donos)
    .gte("ultima_analise_em", inicio.toISOString());

  const candidatas = (linhas ?? []).filter(
    (l: { natureza: string | null; ignorado: boolean | null }) => !l.ignorado && l.natureza !== "nao_lead",
  );

  // Negócio que já tem laudo foi aprendido no fechamento: não lê de novo.
  const ops = candidatas
    .map((l: { oportunidade_id: string | null }) => l.oportunidade_id)
    .filter((x: string | null): x is string => !!x);
  const comLaudo = new Set<string>();
  if (ops.length) {
    const { data: laudos } = await sb
      .from("aura_feedback_fechamento")
      .select("oportunidade_id")
      .in("oportunidade_id", ops);
    for (const l of laudos ?? []) if (l.oportunidade_id) comLaudo.add(l.oportunidade_id as string);
  }

  const desde = inicio.getTime();
  for (const l of candidatas as {
    owner_id: string;
    empresa: string;
    chat_jid: string;
    nome: string | null;
    etapa: string | null;
    oportunidade_id: string | null;
    relacionamento_id: string | null;
    carteira_relacionamento_id: string | null;
    historico: { em?: string; de?: string | null }[] | null;
  }[]) {
    if (!l.empresa || (l.oportunidade_id && comLaudo.has(l.oportunidade_id))) continue;

    const falas = getMessages(l.owner_id, l.chat_jid).filter((m) => !!m.text?.trim());
    const hoje = falas.filter((m) => m.timestamp >= desde);
    const doCliente = hoje.filter((m) => !m.fromMe).length;
    const doVendedor = hoje.length - doCliente;
    if (doCliente < MIN_DO_CLIENTE || doVendedor < MIN_DO_VENDEDOR) continue;

    const andouHoje = (Array.isArray(l.historico) ? l.historico : []).some(
      (h) => !!h?.de && !!h?.em && new Date(h.em).getTime() >= desde,
    );

    const lista = porLoja.get(l.empresa) ?? [];
    lista.push({
      empresa: l.empresa,
      ownerId: l.owner_id,
      chatJid: l.chat_jid,
      oportunidadeId: l.oportunidade_id,
      relacionamentoId: l.relacionamento_id ?? l.carteira_relacionamento_id,
      nome: l.nome ?? "Cliente",
      etapa: l.etapa,
      andouHoje,
      trocaHoje: hoje.length,
      falas,
    });
    porLoja.set(l.empresa, lista);
  }

  for (const [empresa, lista] of porLoja) {
    lista.sort((a, b) => Number(b.andouHoje) - Number(a.andouHoje) || b.trocaHoje - a.trocaHoje);
    porLoja.set(empresa, lista.slice(0, MAX_CONVERSAS_POR_LOJA));
  }
  return porLoja;
}

/** O que a loja já tem (aprovado, esperando ou recusado), para a IA não repetir. */
async function jaConhecidos(sb: SupabaseClient, empresa: string): Promise<string> {
  const { data } = await sb
    .from("aura_aprendizado")
    .select("gatilho, status")
    .eq("empresa", empresa)
    .order("vezes_visto", { ascending: false })
    .limit(80);
  return (data ?? [])
    .map((a: { gatilho: string; status: string }) => `- [${a.status}] ${a.gatilho}`)
    .join("\n");
}

async function avisarGestores(sb: SupabaseClient, empresa: string, novos: number) {
  const { data: gestores } = await sb
    .from("profiles")
    .select("id, cargo, gestor_aprovado")
    .eq("empresa", empresa);
  const ids = (gestores ?? [])
    .filter((g: { cargo: string | null; gestor_aprovado: boolean | null }) => /gestor/i.test(g.cargo ?? "") && g.gestor_aprovado === true)
    .map((g: { id: string }) => g.id);
  if (!ids.length) return;

  const { error } = await sb.from("notificacoes").insert(
    ids.map((id: string) => ({
      vendedor_id: id,
      titulo: `A AURA aprendeu ${novos} ${novos === 1 ? "coisa nova" : "coisas novas"} hoje`,
      mensagem:
        "Tirado das conversas de WhatsApp do dia. Revise em Visão do Gestor → Aprendizado: só entra em uso o que você aprovar.",
      tipo: "aprendizado",
      acao_url: "/gestor",
    })),
  );
  if (error) console.error("[aprendizado-diario] aviso:", error.message);
}

export async function aprenderDaLoja(
  sb: SupabaseClient,
  client: Anthropic,
  empresa: string,
  conversas: Conversa[],
  dia: string,
  casos = "",
): Promise<ResultadoDaLoja> {
  const [manual, aprovado, conhecidos] = await Promise.all([
    nucleoDoManual(sb, empresa).catch(() => ""),
    textoDoAprendizado(sb, empresa).catch(() => ""),
    jaConhecidos(sb, empresa).catch(() => ""),
  ]);

  const system = `Você é o Supervisor AURA, um gerente comercial experiente de um grupo que vende ${SEGMENTOS_EM_UMA_LINHA}. Toda noite você relê as conversas de WhatsApp do dia da loja ${empresa} e separa o que vale ensinar para a equipe.

O QUE PROCURAR
- Objeções reais de cliente (preço, prazo, instalação, concorrência, dúvida técnica) e a resposta que destravou.
- Perguntas que clientes fazem e que merecem resposta padrão.
- Abordagens que fizeram o cliente avançar (mandar planta ou medida, pedir orçamento, marcar visita).
- Quando a resposta dada não funcionou, escreva a resposta que o manual pede.
- Nos CASOS DE SUGESTÃO você vê as suas próprias sugestões de resposta e o que aconteceu: se o vendedor usou, adaptou ou escreveu outra coisa, e se o cliente respondeu ou sumiu. Aprenda com isso: o jeito de escrever que faz o cliente responder, e o que o vendedor escreveu no lugar quando a sua sugestão não servia. Isso vira "abordagem".

REGRAS
- Só o que serve para outros clientes. Nada de nome, endereço, medida ou valor de um orçamento específico.
- Não invente preço, prazo ou garantia: se a conversa e o manual não dizem, não escreva.
- Se conflitar com o MANUAL, o manual manda.
- Não repita o que a loja já tem (lista abaixo). Pouco e bom é melhor que muito e óbvio; lista vazia é aceita.
- No máximo ${MAX_APRENDIZADOS_POR_LOJA} itens.

MANUAL DA LOJA (regras da casa):
${manual || "(sem núcleo do manual cadastrado: use boas práticas de venda consultiva)"}
${aprovado ? `\nJÁ APROVADO PELO GESTOR:\n${aprovado}` : ""}
${conhecidos ? `\nJÁ REGISTRADO (não repita):\n${conhecidos}` : ""}`;

  const partesDoUser: string[] = [];
  if (conversas.length) {
    partesDoUser.push(`Conversas de ${dia} (mais recentes por último em cada uma):\n\n${conversas.map(transcrever).join("\n\n")}`);
  }
  if (casos) partesDoUser.push(`CASOS DE SUGESTÃO (suas sugestões de resposta e o que aconteceu depois):\n${casos}`);
  const user = partesDoUser.join("\n\n");

  let itens: { tipo: TipoAprendizado; gatilho: string; resposta: string; funcionou: boolean; conversas: number[] }[] = [];
  try {
    const resp = await client.messages.create({
      model: modeloDeRaciocinio(),
      max_tokens: 2500,
      system,
      messages: [{ role: "user", content: user }],
      tools: [FERRAMENTA],
      tool_choice: { type: "tool", name: FERRAMENTA.name },
    });
    void registrarUsoIA({ funcao: "aura/aprendizado-diario", modelo: modeloDeRaciocinio(), uso: resp.usage, empresa });

    const bloco = resp.content?.find((c: { type: string }) => c.type === "tool_use") as
      | { input?: { aprendizados?: unknown } }
      | undefined;
    const lista = Array.isArray(bloco?.input?.aprendizados) ? (bloco!.input!.aprendizados as Record<string, unknown>[]) : [];
    itens = lista
      .filter(
        (a) =>
          ["objecao", "pergunta", "abordagem"].includes(String(a?.tipo)) &&
          typeof a?.gatilho === "string" &&
          !!a.gatilho.trim() &&
          typeof a?.resposta === "string" &&
          !!a.resposta.trim(),
      )
      .slice(0, MAX_APRENDIZADOS_POR_LOJA)
      .map((a) => ({
        tipo: a.tipo as TipoAprendizado,
        gatilho: (a.gatilho as string).trim(),
        resposta: (a.resposta as string).trim(),
        funcionou: a.funcionou === true,
        conversas: Array.isArray(a.conversas)
          ? (a.conversas as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= conversas.length)
          : [],
      }));
  } catch (e) {
    console.error("[aprendizado-diario]", empresa, e instanceof Error ? e.message : e);
    return { empresa, conversasLidas: conversas.length, sugeridos: 0, novos: 0, pulou: "a IA não respondeu" };
  }

  let novos = 0;
  for (const a of itens) {
    try {
      const guardado = await guardarAprendizado(sb, {
        empresa,
        canal: "whatsapp",
        tipo: a.tipo,
        gatilho: a.gatilho,
        resposta: a.resposta,
        // "fechou" conta venda fechada; aqui o negócio ainda está aberto.
        fechou: false,
        fonte: `rotina-diaria:${dia}`,
      });
      if (!guardado) continue;
      if (guardado.novo) novos++;
      // De onde saiu: quando aquele negócio fechar ou perder, o placar sabe.
      for (const n of a.conversas) {
        const c = conversas[n - 1];
        await ligarOrigem(sb, {
          aprendizadoId: guardado.id,
          empresa,
          ownerId: c.ownerId,
          chatJid: c.chatJid,
          oportunidadeId: c.oportunidadeId,
          relacionamentoId: c.relacionamentoId,
        });
      }
    } catch (e) {
      console.error("[aprendizado-diario] guardar:", e);
    }
  }
  limparCacheAprendizado(empresa);

  if (novos > 0) await avisarGestores(sb, empresa, novos);
  return { empresa, conversasLidas: conversas.length, sugeridos: itens.length, novos };
}

/** A rodada inteira: todas as lojas com conversa de hoje. */
export async function colherAprendizadoDoDia(sb: SupabaseClient): Promise<ResultadoDaLoja[]> {
  const client = clienteIA();
  if (!client) return [{ empresa: "-", conversasLidas: 0, sugeridos: 0, novos: 0, pulou: "sem chave de IA" }];
  if (!(await podeChamarIA())) {
    return [{ empresa: "-", conversasLidas: 0, sugeridos: 0, novos: 0, pulou: "saldo de IA bloqueado pelo gestor" }];
  }

  const inicio = inicioDoDiaEmBrasilia();
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const porLoja = await conversasDoDia(sb, inicio);

  // Lojas com conversa do dia ou com sugestões da AURA medidas desde ontem.
  const desdeCasos = new Date(inicio.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { data: comSugestao } = await sb
    .from("aura_sugestoes_resultado")
    .select("empresa")
    .gte("enviado_em", desdeCasos)
    .limit(5000);
  const lojas = new Set<string>([...porLoja.keys(), ...(comSugestao ?? []).map((l: { empresa: string }) => l.empresa)]);

  const resultados: ResultadoDaLoja[] = [];
  // Uma loja de cada vez: são poucas, e em série o uso de IA fica previsível.
  for (const empresa of lojas) {
    const conversas = porLoja.get(empresa) ?? [];
    const casos = await casosDeSugestoes(sb, empresa, desdeCasos).catch(() => "");
    if (!conversas.length && !casos) continue;
    resultados.push(await aprenderDaLoja(sb, client, empresa, conversas, dia, casos));
  }
  return resultados;
}
