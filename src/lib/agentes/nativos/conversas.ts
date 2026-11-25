/**
 * OUVINTE DAS CONVERSAS — de 2 em 2 horas (8h às 20h) lê o que o supervisor
 * do WhatsApp já gravou em whatsapp_ia_leads. Só LÊ: o código do WhatsApp
 * não é tocado e nenhuma mensagem é enviada.
 *
 * Duas tarefas:
 *
 * 1. ALERTAS (regra, de graça). O supervisor grava alertas em texto em cada
 *    conversa analisada. O ouvinte separa os que pedem ação agora e manda
 *    para o dono da conversa, um card por conversa:
 *      - risco de perda ("Risco de perda: cliente disse …", "sendo perdido");
 *      - cliente esperando resposta;
 *      - a AURA achou que fechou: confirme e arraste o card (a venda do mês
 *        só entra quando o vendedor confirma).
 *
 * 2. APRENDIZADO (IA rápida, 3 vezes por dia: 12h, 16h e 20h). Junta os
 *    RESUMOS das conversas das últimas horas de cada loja e pede à IA as
 *    objeções e perguntas que se repetem e o que funcionou responder. Antes
 *    de ir para a IA o resumo passa por limparPII: sai telefone, e-mail,
 *    documento, link e o nome do contato. O que volta entra como SUGESTÃO
 *    (nunca aprovado direto) com uma confiança calculada aqui, e o Curador
 *    do Conhecimento decide o resto.
 *
 * A rodada noturna (src/lib/aura/aprendizado-diario.ts) lê as mensagens
 * inteiras de quem está conectado; esta lê só os resumos, mais barata e ao
 * longo do dia. As duas caem na mesma tabela e a chave evita duplicar.
 */
import type { Achado, ContextoAgente, DefinicaoAgente, MensagemEscritorio, Prioridade, ResultadoAgente, SugestaoConhecimento } from "../tipos";
import { temTextoSensivel } from "@/lib/aura/aprendizado";
import { chaveDe, horaEmSaoPaulo, HORA_MS, lerTudo, limitarPorPessoa, limparPII, plural, responsaveisDaLoja } from "./comum";

export type TipoAlerta = "risco" | "espera" | "fechou";

/** Que tipo de ação o alerta gravado pelo supervisor pede (nulo = só informativo). */
export function tipoDoAlerta(texto: string): TipoAlerta | null {
  const t = texto.toLowerCase();
  if (/achou que este neg[oó]cio fechou/.test(t)) return "fechou";
  if (/risco de perda|sendo perdido|perder (o|este|esse) (lead|cliente|neg[oó]cio)/.test(t)) return "risco";
  if (/esperando|aguardando (a |sua )?resposta|sem resposta|n[aã]o respondeu|sem retorno|vácuo|vacuo/.test(t)) return "espera";
  return null;
}

const PESO: Record<TipoAlerta, number> = { risco: 3, espera: 2, fechou: 1 };
const PRIORIDADE: Record<TipoAlerta, Prioridade> = { risco: "alta", espera: "alta", fechou: "media" };

/**
 * Confiança de um aprendizado tirado dos resumos (0–1). Começa baixa, sobe
 * com quantas conversas mostraram o padrão e se a resposta funcionou. Texto
 * com preço, prazo ou número fica no máximo em 0,5: isso é o gestor quem
 * confere (mesma trava de src/lib/aura/aprendizado.ts).
 */
export function confiancaDoAprendizado(a: { vezes: number; funcionou: boolean; texto: string }): number {
  let c = 0.35 + 0.1 * Math.min(Math.max(a.vezes, 1), 4) + (a.funcionou ? 0.15 : 0);
  c = Math.min(c, 0.85);
  if (temTextoSensivel(a.texto)) c = Math.min(c, 0.5);
  return Math.round(c * 100) / 100;
}

interface LeadWa {
  id: string;
  owner_id: string;
  empresa: string | null;
  nome: string | null;
  resumo: string | null;
  proxima_acao: string | null;
  alertas: unknown;
  natureza: string | null;
  updated_at: string;
  oportunidade_id: string | null;
  relacionamento_id: string | null;
}

const HORAS_COM_IA = [12, 16, 20];
const MIN_RESUMOS_PARA_IA = 5;
const MAX_RESUMOS_PARA_IA = 30;
const TIPOS = ["objecao", "pergunta", "abordagem"];

async function aprenderDaLoja(ctx: ContextoAgente, empresa: string, linhas: LeadWa[]): Promise<SugestaoConhecimento[]> {
  const resumos = linhas
    .filter((l) => (l.resumo ?? "").trim().length > 40)
    .slice(0, MAX_RESUMOS_PARA_IA)
    .map((l, i) => `${i + 1}. ${limparPII(l.resumo as string, [l.nome]).slice(0, 350)}`);
  if (resumos.length < MIN_RESUMOS_PARA_IA) return [];
  const r = await ctx.ia({
    perfil: "rapido",
    json: true,
    maxTokens: 900,
    sistema:
      "Você ajuda uma loja de lareiras e aquecimento no Sul do Brasil a aprender com o atendimento no WhatsApp. " +
      "Recebe resumos de conversas (sem dados pessoais). Encontre SÓ padrões que se repetem em 2 ou mais resumos: " +
      "objeções do cliente, perguntas frequentes e abordagens que fizeram o cliente avançar. Nada específico de um cliente. " +
      "Não invente preço, prazo nem medida. Responda apenas JSON no formato " +
      '{"aprendizados":[{"tipo":"objecao|pergunta|abordagem","gatilho":"o que o cliente diz ou a situação, curto",' +
      '"resposta":"o que funciona responder ou fazer, até 2 frases","vezes":2,"funcionou":true}]}. ' +
      "No máximo 5 itens. Lista vazia é uma resposta válida.",
    usuario: `Loja: ${empresa}\nResumos das conversas das últimas horas:\n${resumos.join("\n")}`,
  });
  const lista = r && typeof r === "object" && Array.isArray((r as { aprendizados?: unknown }).aprendizados)
    ? ((r as { aprendizados: unknown[] }).aprendizados)
    : [];
  const saida: SugestaoConhecimento[] = [];
  for (const item of lista.slice(0, 5)) {
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    const tipo = String(a.tipo ?? "");
    const gatilho = String(a.gatilho ?? "").trim();
    const resposta = String(a.resposta ?? "").trim();
    if (!TIPOS.includes(tipo) || gatilho.length < 8 || resposta.length < 8) continue;
    const vezes = Math.min(Number(a.vezes) || 1, resumos.length);
    if (vezes < 2) continue;
    saida.push({
      empresa,
      canal: "whatsapp",
      tipo,
      gatilho: limparPII(gatilho).slice(0, 300),
      resposta: limparPII(resposta).slice(0, 600),
      fonte: "agente/conversas",
      confianca: confiancaDoAprendizado({ vezes, funcionou: a.funcionou === true, texto: `${gatilho} ${resposta}` }),
    });
  }
  return saida;
}

async function executar(ctx: ContextoAgente): Promise<ResultadoAgente> {
  const { sb, agora } = ctx;
  const equipe = await responsaveisDaLoja(sb);
  const comIA = HORAS_COM_IA.includes(horaEmSaoPaulo(agora));
  // Janela dos alertas: desde a rodada anterior (2h) com folga. Para a IA, as últimas 4h.
  const desdeAlertas = agora.getTime() - 2.25 * HORA_MS;
  const desde = new Date(agora.getTime() - (comIA ? 4.25 : 2.25) * HORA_MS).toISOString();

  const linhas = (
    await lerTudo<LeadWa>((de, ate) =>
      sb
        .from("whatsapp_ia_leads")
        .select("id, owner_id, empresa, nome, resumo, proxima_acao, alertas, natureza, updated_at, oportunidade_id, relacionamento_id")
        .eq("ignorado", false)
        .gte("updated_at", desde)
        .order("id")
        .range(de, ate),
    )
  ).filter((l) => l.natureza !== "nao_lead" && l.empresa);

  const comPeso: Array<{ peso: number; a: Achado }> = [];
  const contagem: Record<TipoAlerta, number> = { risco: 0, espera: 0, fechou: 0 };
  for (const l of linhas) {
    if (Date.parse(l.updated_at) < desdeAlertas) continue;
    const alertas = Array.isArray(l.alertas) ? l.alertas.map(String) : [];
    let melhor: { tipo: TipoAlerta; texto: string } | null = null;
    for (const texto of alertas) {
      const tipo = tipoDoAlerta(texto);
      if (tipo && (!melhor || PESO[tipo] > PESO[melhor.tipo])) melhor = { tipo, texto };
    }
    if (!melhor) continue;
    contagem[melhor.tipo]++;
    const destino = equipe.destinoDoItem(l.owner_id, l.empresa as string);
    if (!destino) continue;
    const nome = l.nome?.trim() || "Contato do WhatsApp";
    const titulo =
      melhor.tipo === "risco" ? `Risco de perder: ${nome}` : melhor.tipo === "espera" ? `Cliente esperando resposta: ${nome}` : `Confirme a venda: ${nome}`;
    comPeso.push({ peso: PESO[melhor.tipo], a: {
      chave: chaveDe("conversas", l.id),
      empresa: l.empresa as string,
      destinatarioId: destino,
      titulo,
      descricao: `${melhor.texto.slice(0, 220)}${l.proxima_acao ? `\nPróximo passo sugerido: ${l.proxima_acao.slice(0, 200)}` : ""}`,
      prioridade: PRIORIDADE[melhor.tipo],
      entidadeTipo: l.oportunidade_id ? "oportunidade" : l.relacionamento_id ? "relacionamento" : undefined,
      entidadeId: l.oportunidade_id ?? l.relacionamento_id ?? undefined,
      acaoUrl: "/whatsapp",
      expiraEmDias: melhor.tipo === "espera" ? 1 : 2,
      podeGerarMensagem: melhor.tipo !== "fechou",
    } });
  }
  // Risco primeiro, depois espera: o corte por pessoa respeita esta ordem.
  const achados = comPeso.sort((x, y) => y.peso - x.peso).map((x) => x.a);

  const aprendizados: SugestaoConhecimento[] = [];
  const mensagens: MensagemEscritorio[] = [];
  if (comIA) {
    const porLoja = new Map<string, LeadWa[]>();
    for (const l of linhas) porLoja.set(l.empresa as string, [...(porLoja.get(l.empresa as string) ?? []), l]);
    for (const [empresa, daLoja] of porLoja) {
      const novos = await aprenderDaLoja(ctx, empresa, daLoja);
      if (!novos.length) continue;
      aprendizados.push(...novos);
      const objecoes = novos.filter((n) => n.tipo === "objecao").length;
      mensagens.push({
        de: "conversas",
        para: "curador",
        tipo: "aprendizado",
        empresa,
        texto: `${empresa}: ${plural(novos.length, "padrão novo", "padrões novos")} nas conversas de hoje (${plural(objecoes, "objeção", "objeções")}). Já estão nas sugestões para você revisar.`,
        dados: { gatilhos: novos.map((n) => n.gatilho).slice(0, 5) },
      });
    }
  }

  const { achados: final, cortados } = limitarPorPessoa(achados);
  return {
    resumo:
      `${plural(linhas.length, "conversa analisada", "conversas analisadas")}: ${contagem.risco} com risco de perda, ${contagem.espera} esperando resposta, ${contagem.fechou} possíveis vendas para confirmar` +
      (comIA ? `; ${plural(aprendizados.length, "aprendizado sugerido", "aprendizados sugeridos")}.` : "."),
    achados: final,
    mensagens,
    aprendizados,
    metricas: {
      conversas: linhas.length,
      risco: contagem.risco,
      esperando: contagem.espera,
      vendaParaConfirmar: contagem.fechou,
      aprendizados: aprendizados.length,
      cortadosPeloTeto: cortados,
    },
  };
}

export const agenteConversas: DefinicaoAgente = {
  id: "conversas",
  nome: "Ouvinte das Conversas",
  cargo: "Ouvinte do WhatsApp",
  setor: "conhecimento",
  icone: "MessagesSquare",
  missao: "Lê os resumos das conversas do WhatsApp: avisa quem está deixando cliente esperando ou perto de perder, e tira as objeções que se repetem para a base de conhecimento.",
  agenda: { tipo: "diario", horas: [8, 10, 12, 14, 16, 18, 20], minuto: 0 },
  usaIA: true,
  orcamentoMensalUsd: 3,
  tipo: "nativo",
  executar,
};
