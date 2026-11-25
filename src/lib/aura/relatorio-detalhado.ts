/**
 * Relatório detalhado: os indicadores do time de vendas, um por um, para a
 * loja e para cada vendedor.
 *
 *   1. Receita por vendedor     vendido (a fatia de cada um na venda em dupla)
 *   2. Prospecções              negócios abertos no período + clientes novos
 *   3. Conversão                ganhos ÷ (ganhos + perdidos) — régua de kpis.ts
 *   4. Ticket médio             vendido ÷ vendas
 *   5. Margem                   quanto do preço de tabela foi mantido
 *   7. Ciclo médio de venda     do primeiro registro do cliente/negócio até a venda
 *   8. Cancelamentos            vendas desfeitas ÷ vendas do período
 *   9. Atingimento da meta      vendido no mês ÷ meta do mês
 *  10. Satisfação do cliente    nota média do pós-venda + reclamações
 *
 * (6, upsell e cross-sell, não se aplica: cada cliente compra um sistema.)
 *
 * MARGEM: o sistema não tem o custo dos produtos, então não dá para dar a
 * margem de lucro. O que existe é o preço de tabela (valor_original) e o
 * fechado — a parte do preço que o vendedor segurou na negociação. É essa a
 * "margem" aqui, e a tela diz isso com todas as letras.
 *
 * CANCELAMENTO: não há botão de "cancelar venda". Conta como cancelada a venda
 * com status "cancelada" ou cujo negócio voltou para uma etapa de perda depois
 * de fechado.
 *
 * Funções puras, sem banco.
 */
import type { DadosCrm } from "./dados";
import { ehGanho, ehPerda } from "@/lib/funil";
import { somaDoVendedor, vendasDoVendedor } from "@/lib/parceria";
import { notaMedia, taxaConversao, ticketMedio, totalVendido } from "@/lib/kpis";

const DIA = 86400e3;

/** Uma linha do pós-venda, só com o que o relatório usa. */
export interface PosVendaResumo {
  vendedor_id: string | null;
  empresa: string | null;
  nota: number | null;
  reclamacao: boolean;
  /** Quando o registro de pós-venda nasceu (a venda entrou nele). */
  criado_em: string;
  /** Quando a reclamação foi aberta, se houve. */
  reclamacao_em: string | null;
}

export interface Indicadores {
  receita: number;
  vendas: number;
  ticket: number;
  prospeccoes: number;
  clientesNovos: number;
  ganhos: number;
  perdas: number;
  conversao: number | null;
  /** % do preço de tabela mantido no fechamento; null sem preço de tabela. */
  precoMantido: number | null;
  /** Desconto médio em % sobre o preço de tabela; null sem base. */
  descontoMedio: number | null;
  /** Total de desconto dado no período, em R$. */
  descontoTotal: number;
  /** Vendas com preço de tabela informado (a base da margem). */
  baseMargem: number;
  cicloMedio: number | null;
  cicloMediana: number | null;
  /** Vendas em que deu para medir o ciclo. */
  baseCiclo: number;
  /** Vendas cujo negócio foi cadastrado no próprio dia do fechamento. */
  cadastradasNoFechamento: number;
  canceladas: number;
  taxaCancelamento: number | null;
  metaMes: number | null;
  vendidoMes: number;
  atingimento: number | null;
  notaMedia: number | null;
  avaliacoes: number;
  reclamacoes: number;
}

export interface IndicadoresVendedor extends Indicadores {
  id: string;
  nome: string;
  loja: string;
}

export interface RelatorioDetalhado {
  mes: string;
  geral: Indicadores;
  porVendedor: IndicadoresVendedor[];
}

/** Dia de calendário em São Paulo (AAAA-MM-DD). */
function diaSP(t: number | string) {
  return new Date(t).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function diasEntre(deIso: string, ateDia: string): number {
  const de = Date.parse(`${diaSP(deIso)}T12:00:00-03:00`);
  const ate = Date.parse(`${ateDia}T12:00:00-03:00`);
  return Math.max(0, Math.round((ate - de) / DIA));
}

function mediana(ns: number[]): number | null {
  if (!ns.length) return null;
  const o = [...ns].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : Math.round((o[m - 1] + o[m]) / 2);
}

const pct = (parte: number, todo: number) => (todo > 0 ? Math.round((parte / todo) * 1000) / 10 : null);

/**
 * Os indicadores de um recorte. `vendedorId` presente = a régua de um
 * vendedor (fatia na venda em dupla, metas dele); ausente = a loja/grupo.
 */
function calcular(
  d: DadosCrm,
  posVendas: PosVendaResumo[],
  filtro: { loja?: string; vendedorId?: string; vendedoresDaMeta: string[] },
  inicio: number,
  fim: number,
  mes: string,
): Indicadores {
  const { loja, vendedorId } = filtro;
  const doDono = <T extends { owner_id: string; empresa?: string | null }>(x: T) =>
    (!vendedorId || x.owner_id === vendedorId) && (!loja || x.empresa === loja);
  const noPeriodo = (iso: string | null | undefined) => {
    if (!iso) return false;
    const t = Date.parse(iso);
    return t >= inicio && t <= fim;
  };

  const daLoja = d.vendas.filter((v) => !loja || v.empresa === loja);
  const minhas = vendedorId ? vendasDoVendedor(daLoja, vendedorId) : daLoja;
  const vendas = minhas.filter((v) => noPeriodo(`${v.data}T12:00:00-03:00`));
  const receita = totalVendido(vendas, vendedorId);

  const ops = d.oportunidades.filter(doDono);
  const opPorId = new Map(d.oportunidades.map((o) => [o.id, o]));
  const relPorId = new Map(d.relacionamentos.map((r) => [r.id, r]));
  const opsDecididas = ops.filter((o) => noPeriodo(o.updated_at ?? o.created_at));
  const ganhos = opsDecididas.filter((o) => ehGanho(o.etapa, d.funil)).length;
  const perdas = opsDecididas.filter((o) => ehPerda(o.etapa, d.funil)).length;

  // Margem: só as vendas com preço de tabela, para o desconto não sair de
  // uma base que mistura venda com e sem preço informado.
  let tabela = 0;
  let fechado = 0;
  let baseMargem = 0;
  const descontos: number[] = [];
  for (const v of vendas) {
    const original = Number(v.valor_original ?? 0);
    if (!(original > 0)) continue;
    const final = Number(v.valor_fechado ?? v.valor ?? 0);
    tabela += original;
    fechado += final;
    baseMargem += 1;
    descontos.push(Math.max(0, ((original - final) / original) * 100));
  }
  const precoMantido = tabela > 0 ? Math.round((fechado / tabela) * 1000) / 10 : null;
  const descontoMedio = descontos.length
    ? Math.round((descontos.reduce((s, n) => s + n, 0) / descontos.length) * 10) / 10
    : null;

  // Ciclo: do primeiro registro (cliente ou negócio, o que veio antes) até a venda.
  const ciclos: number[] = [];
  let cadastradasNoFechamento = 0;
  for (const v of vendas) {
    const op = v.oportunidade_id ? opPorId.get(v.oportunidade_id) : undefined;
    const rel = relPorId.get(v.relacionamento_id ?? op?.relacionamento_id ?? "");
    const datas = [op?.created_at, rel?.created_at].filter((x): x is string => !!x);
    if (!datas.length) continue;
    const primeiro = datas.reduce((a, b) => (Date.parse(a) <= Date.parse(b) ? a : b));
    const dias = diasEntre(primeiro, v.data);
    ciclos.push(dias);
    if (dias === 0) cadastradasNoFechamento += 1;
  }

  const canceladas = vendas.filter((v) => {
    if ((v.status ?? "").toLowerCase().startsWith("cancel")) return true;
    const op = v.oportunidade_id ? opPorId.get(v.oportunidade_id) : undefined;
    return !!op && ehPerda(op.etapa, d.funil);
  }).length;

  // Meta do mês corrente: a soma das metas de quem está no recorte.
  const metas = d.metas.filter((m) => m.mes === mes && filtro.vendedoresDaMeta.includes(m.owner_id));
  const metaMes = metas.length ? metas.reduce((s, m) => s + m.valor_meta, 0) : null;
  const doMes = minhas.filter((v) => v.data.slice(0, 7) === mes);
  const vendidoMes = vendedorId ? somaDoVendedor(doMes, vendedorId) : totalVendido(doMes);

  const pv = posVendas.filter(
    (p) => (!vendedorId || p.vendedor_id === vendedorId) && (!loja || p.empresa === loja),
  );
  const notas = pv.filter((p) => noPeriodo(p.criado_em)).map((p) => p.nota);

  return {
    receita,
    vendas: vendas.length,
    ticket: ticketMedio(receita, vendas.length),
    prospeccoes: ops.filter((o) => noPeriodo(o.created_at)).length,
    clientesNovos: d.relacionamentos.filter((r) => doDono(r) && noPeriodo(r.created_at)).length,
    ganhos,
    perdas,
    conversao: taxaConversao(ganhos, perdas),
    precoMantido,
    descontoMedio,
    descontoTotal: Math.round(Math.max(0, tabela - fechado)),
    baseMargem,
    cicloMedio: ciclos.length ? Math.round(ciclos.reduce((s, n) => s + n, 0) / ciclos.length) : null,
    cicloMediana: mediana(ciclos),
    baseCiclo: ciclos.length,
    cadastradasNoFechamento,
    canceladas,
    taxaCancelamento: pct(canceladas, vendas.length),
    metaMes,
    vendidoMes,
    atingimento: metaMes && metaMes > 0 ? Math.round((vendidoMes / metaMes) * 100) : null,
    notaMedia: (() => {
      const n = notaMedia(notas);
      return n == null ? null : Math.round(n * 10) / 10;
    })(),
    avaliacoes: notas.filter((n) => n != null && n > 0).length,
    reclamacoes: pv.filter((p) => p.reclamacao && noPeriodo(p.reclamacao_em ?? p.criado_em)).length,
  };
}

export function montarRelatorioDetalhado(
  d: DadosCrm,
  escopo: { loja?: string; vendedorId?: string },
  periodoDias: number,
  posVendas: PosVendaResumo[],
  agora = Date.now(),
): RelatorioDetalhado {
  return montarRelatorioDetalhadoJanela(d, escopo, agora - periodoDias * DIA, agora, posVendas);
}

/**
 * O mesmo relatório para uma janela fechada (a semana do relatório semanal,
 * ou a anterior, para comparar). A meta é a do mês em que a janela termina.
 */
export function montarRelatorioDetalhadoJanela(
  d: DadosCrm,
  escopo: { loja?: string; vendedorId?: string },
  inicio: number,
  fim: number,
  posVendas: PosVendaResumo[],
): RelatorioDetalhado {
  const mes = diaSP(fim).slice(0, 7);
  const vendedores = d.perfis.filter(
    (p) =>
      p.ativo !== false &&
      /vendedor/i.test(p.cargo ?? "") &&
      (!escopo.loja || p.empresa === escopo.loja) &&
      (!escopo.vendedorId || p.id === escopo.vendedorId),
  );
  const idsMeta = escopo.vendedorId ? [escopo.vendedorId] : vendedores.map((p) => p.id);

  return {
    mes,
    geral: calcular(d, posVendas, { ...escopo, vendedoresDaMeta: idsMeta }, inicio, fim, mes),
    porVendedor: vendedores
      .map((p) => ({
        id: p.id,
        nome: p.nome,
        loja: p.empresa,
        ...calcular(
          d,
          posVendas,
          { loja: escopo.loja, vendedorId: p.id, vendedoresDaMeta: [p.id] },
          inicio,
          fim,
          mes,
        ),
      }))
      .sort((a, b) => b.receita - a.receita || b.prospeccoes - a.prospeccoes),
  };
}

