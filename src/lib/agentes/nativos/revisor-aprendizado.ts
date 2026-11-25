/**
 * REVISOR DO APRENDIZADO — de 2 em 2 horas (8h às 20h, segunda a sábado)
 * decide as sugestões de aprendizado da AURA: aprova, recusa ou deixa para o
 * gestor.
 *
 * POR QUE EXISTE: as sugestões chegam todo dia (laudo de fechamento, rodada
 * noturna, Ouvinte das Conversas) e o gestor não dá conta — eram 492 na fila
 * e 9 aprovadas em 25/11/2026. Fila parada é AURA que para de aprender. O
 * dono autorizou um agente a decidir.
 *
 * É A ÚNICA EXCEÇÃO DOCUMENTADA à regra "agente não altera dado" (contrato,
 * regra 2). Ela é estreita:
 *   - só mexe em aura_aprendizado com status "sugerido" (o update exige
 *     status = 'sugerido': aprovado e recusado nunca são tocados);
 *   - só escreve status, resposta (quando aprova com o texto corrigido),
 *     revisado_em, aprovado_auto e, com a migração 110, quem decidiu, por quê
 *     e com que confiança (revisado_por fica nulo: não foi uma pessoa);
 *   - toda mudança fica no histórico do conhecimento (gatilho da 110) e o
 *     gestor desfaz com um clique em Visão do Gestor → Aprendizado;
 *   - item que um gestor DESFEZ não volta para o revisor: a palavra final ali
 *     já é de gente (lido do histórico).
 *
 * COMO DECIDE, por rodada:
 *   1. pega as 60 sugestões mais antigas ainda não revisadas;
 *   2. regra primeiro, de graça (revisor-regras.ts): dado pessoal → recusa;
 *      repete um aprovado → recusa; perdeu mais que fechou → gestor;
 *   3. o resto vai para a IA (perfil "redacao") em lotes de 10, cada item com
 *      a evidência, os aprovados parecidos da loja e trechos dos materiais da
 *      loja (src/lib/conhecimento/recuperar.ts + busca de trechos);
 *   4. o parecer passa pelas travas em código: confiança < 0,75 → gestor;
 *      preço, prazo, garantia, pagamento ou número sem apoio nos materiais →
 *      gestor; repetido de algo aprovado nesta mesma rodada → recusa.
 *   O que fica para o gestor vira UM card por loja ("N aprendizados precisam
 *   da sua decisão") e não volta para a IA (não paga duas vezes pela mesma
 *   dúvida).
 */
import type { Achado, ContextoAgente, DefinicaoAgente, MensagemEscritorio, ResultadoAgente } from "../tipos";
import { faltaNoBanco } from "../util";
import { limparCacheAprendizado } from "@/lib/aura/aprendizado";
import { ranquear, type ItemConhecimento } from "@/lib/conhecimento/recuperar";
import { chaveDe, lerTudo, listaCurta, plural, responsaveisDaLoja } from "./comum";
import {
  CONFIANCA_MINIMA, decisaoFinal, decisaoPorRegra, duplicadoDe, emLotes, validarPareceres,
  type DecisaoFinal, type ItemRevisao,
} from "./revisor-regras";

export const ID_REVISOR = "revisor-aprendizado";
const MAX_POR_RODADA = 60;

interface LinhaPendente extends ItemRevisao {
  canal: string;
  criado_em: string;
  revisado_por_agente?: string | null;
}

interface Aprovado {
  id: string;
  empresa: string;
  tipo: string;
  gatilho: string;
  resposta: string;
}

/** Itens que o revisor deixou para o gestor quando a 110 ainda não existe (para não reenviar à IA). */
const g = globalThis as unknown as { __revisorMantidos?: Set<string> };
const mantidosSemColuna = (g.__revisorMantidos ??= new Set<string>());

const SISTEMA = [
  "Você revisa sugestões de aprendizado da AURA, a assistente de vendas de lojas de lareiras e aquecimento no Sul do Brasil",
  "(MF International, LF Lareiras, A&G Aquecimento, Sole Aquecimento). Cada sugestão é uma situação do cliente (gatilho) e o",
  "que responder (resposta). O que você aprovar passa a ser repetido pela AURA para todos os clientes da loja.",
  "",
  "Para CADA item decida:",
  "- recusar: repete um aprendizado já aprovado da loja (lista 'aprovados_parecidos'); contradiz um aprovado; inventa preço,",
  "  desconto, prazo, garantia, forma de pagamento ou especificação técnica que os 'materiais' da loja não confirmam;",
  "  é ofensivo, fora do ramo, específico de um cliente ou tem dado pessoal; é óbvio demais para ajudar.",
  "- aprovar: útil, correto, no tom da loja (cordial, direto, consultivo) e reutilizável com outros clientes.",
  "  Se a ideia é boa mas o texto precisa de ajuste pequeno, aprove com 'resposta_ajustada' (sem inventar nada).",
  "- manter: quando não tem certeza ou quando a evidência de vendas contradiz (perdeu mais do que fechou).",
  "Use 'confianca' de 0 a 1 com honestidade; abaixo de 0.75 o item fica para o gestor de qualquer jeito.",
  "'motivo': UMA frase curta em português do Brasil.",
  "",
  'Responda só JSON: {"decisoes":[{"id":"...","decisao":"aprovar|recusar|manter","motivo":"...","confianca":0.0,"resposta_ajustada":"opcional"}]}',
  "com exatamente um objeto por item recebido.",
].join("\n");

async function trechosDaLoja(empresa: string, consulta: string, sb: ContextoAgente["sb"]): Promise<string[]> {
  try {
    const { trechosRelevantes } = await import("@/lib/aura/trechos");
    const lista = await trechosRelevantes(sb, empresa, consulta, 3);
    return lista.map((t) => `${t.origem}: ${t.texto}`.slice(0, 500));
  } catch {
    return [];
  }
}

async function executar(ctx: ContextoAgente): Promise<ResultadoAgente> {
  const { sb } = ctx;
  const equipe = await responsaveisDaLoja(sb);
  const BASE = "id, empresa, canal, tipo, gatilho, resposta, vezes_visto, vezes_fechou, vezes_perdeu, criado_em";

  // Pendentes (com as colunas da 110, se existirem).
  let temColunas = true;
  let pendentes: LinhaPendente[];
  try {
    pendentes = await lerTudo<LinhaPendente>((de, ate) =>
      sb.from("aura_aprendizado").select(`${BASE}, revisado_por_agente`).eq("status", "sugerido").order("id").range(de, ate),
    );
  } catch (e) {
    if (!faltaNoBanco({ message: (e as Error).message })) throw e;
    temColunas = false;
    pendentes = await lerTudo<LinhaPendente>((de, ate) =>
      sb.from("aura_aprendizado").select(BASE).eq("status", "sugerido").order("id").range(de, ate),
    );
  }

  // O que um gestor desfez (voltou de aprovado/recusado para sugerido) é dele.
  const desfeitos = new Set<string>();
  {
    const { data, error } = await sb
      .from("aura_conhecimento_historico")
      .select("registro_id")
      .eq("tabela", "aura_aprendizado")
      .eq("operacao", "UPDATE")
      .in("antes->>status", ["aprovado", "recusado"])
      .eq("depois->>status", "sugerido")
      .limit(5000);
    if (!error) for (const r of (data ?? []) as Array<{ registro_id: string | null }>) if (r.registro_id) desfeitos.add(r.registro_id);
  }

  const jaMantidos = pendentes.filter((p) => p.revisado_por_agente || mantidosSemColuna.has(p.id));
  const fila = pendentes
    .filter((p) => !p.revisado_por_agente && !mantidosSemColuna.has(p.id) && !desfeitos.has(p.id))
    .sort((a, b) => a.criado_em.localeCompare(b.criado_em))
    .slice(0, MAX_POR_RODADA)
    .map((p) => ({ ...p, vezes_visto: p.vezes_visto ?? 0, vezes_fechou: p.vezes_fechou ?? 0 }));

  if (!fila.length) {
    return {
      resumo: jaMantidos.length ? `Nada novo para revisar; ${plural(jaMantidos.length, "item")} esperando o gestor.` : "Nada novo para revisar.",
      achados: [],
      metricas: { revisados: 0, aprovados: 0, recusados: 0, mantidos: 0, esperandoGestor: jaMantidos.length },
    };
  }

  const aprovados = await lerTudo<Aprovado>((de, ate) =>
    sb.from("aura_aprendizado").select("id, empresa, tipo, gatilho, resposta").eq("status", "aprovado").order("id").range(de, ate),
  );

  // 1. Regras de graça.
  const decisoes = new Map<string, DecisaoFinal>();
  const paraIA: LinhaPendente[] = [];
  for (const item of fila) {
    const d = decisaoPorRegra(item, aprovados);
    if (d) decisoes.set(item.id, d);
    else paraIA.push(item);
  }

  // 2. Parecer da IA, em lotes, com o contexto de cada item.
  const materiaisDe = new Map<string, string>();
  let semIA = 0;
  /*
   * Cada lote leva ~1 minuto de IA. A rodada tem 240 s; as decisões só são
   * gravadas no passo 3. Na 2ª rodada real (25/11) os 6 lotes passaram do
   * prazo e NADA foi gravado (US$ 0,32 perdidos). Agora, passou de 150 s, não
   * abre lote novo: grava o que já decidiu e o resto fica para a próxima.
   */
  const comecou = Date.now();
  const PRAZO_LOTES_MS = 150_000;
  for (const lote of emLotes(paraIA)) {
    if (Date.now() - comecou > PRAZO_LOTES_MS) {
      semIA += lote.length;
      continue;
    }
    const entrada = await Promise.all(
      lote.map(async (item) => {
        const daLoja: ItemConhecimento[] = aprovados
          .filter((a) => a.empresa === item.empresa)
          .map((a) => ({ tipo: "aprendizado", id: a.id, texto: `"${a.gatilho}" → ${a.resposta}`.slice(0, 400), busca: `${a.gatilho} ${a.resposta}` }));
        const parecidos = ranquear(daLoja, item.gatilho, 300).slice(0, 3).map((a) => a.texto);
        const materiais = await trechosDaLoja(item.empresa, `${item.gatilho} ${item.resposta}`, sb);
        materiaisDe.set(item.id, materiais.join("\n"));
        return {
          id: item.id,
          empresa: item.empresa,
          tipo: item.tipo,
          gatilho: item.gatilho.slice(0, 500),
          resposta: item.resposta.slice(0, 1200),
          evidencia: { visto: item.vezes_visto, fechou: item.vezes_fechou, perdeu: item.vezes_perdeu ?? 0 },
          aprovados_parecidos: parecidos,
          materiais,
        };
      }),
    );
    const r = await ctx.ia({
      perfil: "redacao",
      json: true,
      // 10 pareceres com motivo e, às vezes, a resposta ajustada passam de
      // 2.500 tokens: a 1ª rodada real (25/11) parou nos 2.500 nas 6 chamadas,
      // o JSON veio cortado e nada foi decidido (US$ 0,30 gastos à toa).
      maxTokens: 6000,
      sistema: SISTEMA,
      usuario: `Itens para revisar (JSON):\n${JSON.stringify(entrada)}`,
    });
    if (r === null) {
      // Sem saldo, sem orçamento ou falha: os itens ficam intactos para a próxima rodada.
      semIA += lote.length;
      continue;
    }
    const pareceres = validarPareceres(r, lote.map((i) => i.id));
    for (const item of lote) {
      const p = pareceres.get(item.id);
      if (!p) continue; // parecer inválido: tenta de novo na próxima rodada
      decisoes.set(item.id, decisaoFinal(item, p, materiaisDe.get(item.id) ?? ""));
    }
  }

  // 3. Aplica, um por um (o que aprovar agora entra na conta de repetidos do próximo).
  const agoraIso = ctx.agora.toISOString();
  const contagem = { aprovar: 0, recusar: 0, manter: 0 };
  const lojasComAprovacao = new Set<string>();
  const destaques: Array<{ empresa: string; gatilho: string; fechou: number }> = [];
  const mantidosAgora: LinhaPendente[] = [];
  for (const item of fila) {
    let d = decisoes.get(item.id);
    if (!d) continue;
    if (d.decisao === "aprovar" && duplicadoDe(item, aprovados)) {
      d = { decisao: "recusar", motivo: "Repete um aprendizado aprovado nesta mesma revisão.", confianca: 1, porRegra: true };
    }
    const meta = { revisado_por_agente: ID_REVISOR, revisao_motivo: d.motivo, revisao_confianca: Math.round(d.confianca * 100) / 100 };
    let patch: Record<string, unknown> | null = null;
    if (d.decisao === "aprovar") {
      patch = { status: "aprovado", aprovado_auto: true, revisado_por: null, revisado_em: agoraIso };
      if (d.novaResposta) patch.resposta = d.novaResposta;
    } else if (d.decisao === "recusar") {
      patch = { status: "recusado", aprovado_auto: false, revisado_por: null, revisado_em: agoraIso };
    }
    // "manter" só deixa o motivo (com a 110); o status continua sugerido.
    const aplicar = async (comMeta: boolean) => {
      const corpo = { ...(patch ?? {}), ...(comMeta ? meta : {}) };
      if (!Object.keys(corpo).length) return { ok: true, erro: null as null | { code?: string; message?: string } };
      const { data, error } = await sb.from("aura_aprendizado").update(corpo).eq("id", item.id).eq("status", "sugerido").select("id");
      return { ok: !error && (data?.length ?? 0) > 0, erro: error };
    };
    let res = await aplicar(temColunas);
    if (res.erro && temColunas && faltaNoBanco(res.erro)) {
      temColunas = false;
      res = await aplicar(false);
    }
    if (d.decisao === "manter") {
      if (!temColunas) mantidosSemColuna.add(item.id);
      contagem.manter++;
      mantidosAgora.push(item);
      continue;
    }
    if (!res.ok) {
      if (res.erro) ctx.log("revisor: não consegui gravar", item.id, res.erro.message);
      continue; // alguém decidiu antes (status já não é sugerido) ou falhou: não conta
    }
    contagem[d.decisao]++;
    if (d.decisao === "aprovar") {
      lojasComAprovacao.add(item.empresa);
      aprovados.push({ id: item.id, empresa: item.empresa, tipo: item.tipo, gatilho: item.gatilho, resposta: d.novaResposta ?? item.resposta });
      destaques.push({ empresa: item.empresa, gatilho: item.gatilho, fechou: item.vezes_fechou });
    }
  }
  for (const l of lojasComAprovacao) limparCacheAprendizado(l);

  // 4. Um card por loja (o mestre recebe um só, com as lojas) para o que ficou com o gestor.
  const esperando = new Map<string, number>();
  for (const p of [...jaMantidos, ...mantidosAgora]) esperando.set(p.empresa, (esperando.get(p.empresa) ?? 0) + 1);
  const achados: Achado[] = [];
  const linhasMestre = new Map<string, string[]>();
  for (const [empresa, n] of esperando) {
    const destino = equipe.gestoresPara(empresa);
    if (destino.mestres) {
      for (const id of destino.ids) linhasMestre.set(id, [...(linhasMestre.get(id) ?? []), `${empresa}: ${n}`]);
      continue;
    }
    for (const id of destino.ids) {
      achados.push({
        chave: chaveDe(ID_REVISOR, "decidir", id),
        empresa,
        destinatarioId: id,
        titulo: `${plural(n, "aprendizado precisa", "aprendizados precisam")} da sua decisão`,
        descricao: `O revisor não teve certeza (confiança abaixo de ${CONFIANCA_MINIMA}, resultado contraditório ou valor sem apoio nos materiais). O motivo está em cada item.`,
        prioridade: n >= 20 ? "alta" : "media",
        entidadeTipo: "perfil",
        entidadeId: id,
        acaoUrl: "/gestor?aba=aprendizado",
        expiraEmDias: 1,
      });
    }
  }
  for (const [id, linhas] of linhasMestre) {
    const total = linhas.reduce((s, l) => s + Number(l.split(": ")[1] ?? 0), 0);
    achados.push({
      chave: chaveDe(ID_REVISOR, "decidir", id),
      empresa: equipe.pessoa(id)?.empresa ?? "",
      destinatarioId: id,
      titulo: `${plural(total, "aprendizado precisa", "aprendizados precisam")} da sua decisão`,
      descricao: `O revisor deixou para você o que não teve certeza. Por loja:\n${listaCurta(linhas)}`,
      prioridade: total >= 20 ? "alta" : "media",
      entidadeTipo: "perfil",
      entidadeId: id,
      acaoUrl: "/gestor?aba=aprendizado",
      expiraEmDias: 1,
    });
  }

  // 5. Escritório.
  const mensagens: MensagemEscritorio[] = [
    {
      de: ID_REVISOR,
      para: "todos",
      tipo: "relato",
      texto:
        `Revisei ${plural(contagem.aprovar + contagem.recusar + contagem.manter, "aprendizado")}: ${contagem.aprovar} aprovados, ` +
        `${contagem.recusar} recusados e ${contagem.manter} deixados para o gestor.` +
        (semIA ? ` ${semIA} ficaram para a próxima rodada (IA indisponível).` : ""),
      dados: { ...contagem, semIA },
    },
  ];
  if (destaques.length) {
    const top = destaques.sort((a, b) => b.fechou - a.fechou).slice(0, 5);
    mensagens.push({
      de: ID_REVISOR,
      para: "curador",
      tipo: "aprendizado",
      texto: `Entraram em uso: ${top.map((t) => `"${t.gatilho.slice(0, 60)}" (${t.empresa})`).join("; ")}.`,
      dados: { aprovados: destaques.length },
    });
  }

  return {
    resumo: `${contagem.aprovar} aprovados, ${contagem.recusar} recusados, ${contagem.manter} para o gestor${semIA ? `, ${semIA} adiados (sem IA)` : ""}.`,
    achados,
    mensagens,
    metricas: {
      revisados: contagem.aprovar + contagem.recusar + contagem.manter,
      aprovados: contagem.aprovar,
      recusados: contagem.recusar,
      mantidos: contagem.manter,
      adiadosSemIA: semIA,
      esperandoGestor: jaMantidos.length + mantidosAgora.length,
      filaRestante: Math.max(0, pendentes.length - jaMantidos.length - desfeitos.size - fila.length),
      colunasDaRevisao: temColunas ? 1 : 0,
    },
  };
}

export const agenteRevisorAprendizado: DefinicaoAgente = {
  id: ID_REVISOR,
  nome: "Revisor do Aprendizado",
  cargo: "Revisor da base de conhecimento",
  setor: "conhecimento",
  icone: "BadgeCheck",
  missao:
    "Aprova ou recusa as sugestões de aprendizado da AURA com base na evidência e nos materiais da loja, e deixa para o gestor só o que tem dúvida. Tudo reversível.",
  agenda: { tipo: "diario", horas: [8, 10, 12, 14, 16, 18, 20], minuto: 0, diasSemana: [1, 2, 3, 4, 5, 6] },
  usaIA: true,
  orcamentoMensalUsd: 5,
  tipo: "nativo",
  executar,
};
