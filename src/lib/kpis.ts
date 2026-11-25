/**
 * Os números que aparecem em mais de uma tela, com UMA conta só.
 *
 * ANTES (auditoria de 25/11/2026): "pipeline aberto" era calculado de quatro
 * jeitos. O quadro do Pipeline somava só as etapas marcadas "conta no
 * pipeline"; o cartão da AURA somava todo negócio não decidido; o painel do
 * gestor somava os abertos com Prospecção e pós-venda junto; o resumo
 * executivo da IA somava TODOS os negócios, inclusive os ganhos e os perdidos
 * (R$ 5,5 milhões "em aberto" numa loja que tinha R$ 5,2 milhões de verdade).
 * "Vendido" ora era a fatia de cada um na venda em dupla, ora a venda inteira
 * do dono; "negócios parados" contava os cards de pós-venda, que ficam
 * parados ali por natureza.
 *
 * As regras que valem, e que toda tela deve pedir daqui:
 *
 *   pipeline aberto   dinheiro nas etapas abertas que o gestor marcou como
 *                     "conta no pipeline" (contaNoPipeline, src/lib/funil.ts);
 *   negócio em aberto etapa do tipo "aberta", fora a coluna de leads frios —
 *                     ganho, perda e pós-venda não estão mais em jogo;
 *   vendido           valor fechado (ou o valor, se não houver); por vendedor,
 *                     a fatia dele na venda em dupla (src/lib/parceria.ts);
 *   ticket médio      vendido ÷ quantidade de vendas, arredondado;
 *   conversão         ganhos ÷ (ganhos + perdidos) — só o que já se decidiu;
 *   nota média        média só de quem deu nota (avaliar sem nota não puxa a
 *                     média para baixo).
 *
 * Funções puras, sem banco: servem ao servidor e ao navegador do mesmo jeito.
 */
import { acharEtapa, contaNoPipeline, type EtapaFunil } from "@/lib/funil";
import {
  somaDoVendedor,
  valorCheio,
  vendasDoVendedor,
  type VendaComParceria,
} from "@/lib/parceria";

/** Valor numérico seguro: texto do banco, nulo ou NaN viram 0. */
function numero(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Negócio ainda em jogo: etapa aberta do funil, fora a coluna de leads frios.
 *
 * Pós-venda NÃO entra: o cliente já comprou, e o card fica ali parado por
 * natureza — contá-lo como "negócio parado" acusava o vendedor por uma venda
 * feita. Etapa que o funil não reconhece também não entra: não se cobra o
 * que não se sabe onde está.
 */
export function negocioEmAberto(
  etapa: string | null | undefined,
  funil: EtapaFunil[],
): boolean {
  const e = acharEtapa(etapa, funil);
  return !!e && e.tipo === "aberta" && e.chave !== "lead_frio";
}

export interface ResumoPipeline {
  /** Dinheiro nas etapas que contam no pipeline. */
  valor: number;
  /** Quantos negócios formam esse valor. */
  qtd: number;
}

/** O pipeline aberto: a mesma conta do cabeçalho do quadro do Pipeline. */
export function pipelineAberto(
  negocios: { etapa?: string | null; valor?: number | string | null }[],
  funil: EtapaFunil[],
): ResumoPipeline {
  let valor = 0;
  let qtd = 0;
  for (const o of negocios) {
    if (!contaNoPipeline(o.etapa ?? null, funil)) continue;
    valor += numero(o.valor);
    qtd += 1;
  }
  return { valor, qtd };
}

/**
 * Vendas cuja data cai no mês "AAAA-MM". A coluna `data` é um dia de
 * calendário (sem hora), então comparar o prefixo é exato — sem fuso no meio.
 */
export function vendasDoMes<T extends { data?: string | null }>(vendas: T[], mes: string): T[] {
  return vendas.filter((v) => typeof v.data === "string" && v.data.slice(0, 7) === mes);
}

/**
 * Quanto foi vendido. Com `vendedorId`, só a fatia dessa pessoa (dono ou
 * parceiro); sem ele, o valor cheio de cada venda — o que a loja vendeu.
 */
export function totalVendido(
  vendas: VendaComParceria[],
  vendedorId?: string | null,
): number {
  if (vendedorId) return somaDoVendedor(vendas, vendedorId);
  return vendas.reduce((s, v) => s + valorCheio(v), 0);
}

/**
 * Quantas vendas. Com `vendedorId`, as que a pessoa fechou, sozinha ou em
 * dupla — a venda em dupla conta inteira para cada um; o que se divide é o
 * dinheiro.
 */
export function quantidadeDeVendas(
  vendas: VendaComParceria[],
  vendedorId?: string | null,
): number {
  return vendedorId ? vendasDoVendedor(vendas, vendedorId).length : vendas.length;
}

/** Ticket médio arredondado; 0 quando não houve venda. */
export function ticketMedio(valor: number, quantidade: number): number {
  return quantidade > 0 ? Math.round(valor / quantidade) : 0;
}

/** Conversão em % sobre o que já foi decidido; null quando nada se decidiu. */
export function taxaConversao(ganhos: number, perdas: number): number | null {
  const decididos = ganhos + perdas;
  return decididos > 0 ? Math.round((ganhos / decididos) * 100) : null;
}

/**
 * Atividade que o vendedor fez, e não um registro automático do sistema
 * ("Oportunidade criada", "IA moveu…", "Etapa alterada…"). É a régua de
 * "atividades na semana" da AURA e dos pontos de atividade do ranking.
 */
export function ehAtividadeDoVendedor(a: { tipo?: string | null; titulo?: string | null }): boolean {
  return !(a.tipo === "Outro" && /^(Oportunidade |IA moveu|Etapa alterada)/.test(a.titulo ?? ""));
}

/** Média das notas dadas (1 a 5); quem não deu nota fica fora da conta. */
export function notaMedia(notas: (number | string | null | undefined)[]): number | null {
  const validas = notas.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
  return validas.length ? validas.reduce((s, n) => s + n, 0) / validas.length : null;
}
