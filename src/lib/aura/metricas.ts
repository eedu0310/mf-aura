/**
 * Métricas do CRM calculadas de forma exata (sem IA). A IA recebe estes
 * números prontos e só escreve o recado; os números mostrados na tela vêm
 * daqui, nunca "inventados" pelo modelo.
 */
import type { Ativ, Comp, DadosCrm, Op, Rel, Venda } from "./dados";

export const ETAPAS = ["Prospecção", "Apresentação", "Proposta", "Negociação", "Fechados", "Perdidos"] as const;
export const ETAPAS_ABERTAS = ["Prospecção", "Apresentação", "Proposta", "Negociação"];

const DIA = 86400e3;
const TZ = "America/Sao_Paulo";

/** yyyy-mm-dd no fuso de São Paulo. */
export function diaSP(d: Date | number | string = new Date()) {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: TZ });
}

export function mesSP(d: Date | number | string = new Date()) {
  return diaSP(d).slice(0, 7);
}

function mesAnterior(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 2, 15));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function diasNoMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

const valorVenda = (v: Venda) => v.valor_fechado ?? v.valor ?? 0;
const quandoAtiv = (a: Ativ) => a.ocorrida_em ?? a.created_at;
const ehAtividadeDoVendedor = (a: Ativ) =>
  !(a.tipo === "Outro" && /^(Oportunidade |IA moveu|Etapa alterada)/.test(a.titulo ?? ""));

export function diasDesde(iso: string | null | undefined, agora = Date.now()) {
  if (!iso) return null;
  return Math.floor((agora - new Date(iso).getTime()) / DIA);
}

export function moeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// ------------------------------------------------------------------ filtros

export interface Escopo {
  /** undefined = todos os vendedores visíveis */
  vendedorId?: string;
  /** undefined = todas as lojas visíveis */
  loja?: string;
}

function noEscopo<T extends { owner_id: string; empresa?: string | null }>(lista: T[], e: Escopo) {
  return lista.filter((x) => (!e.vendedorId || x.owner_id === e.vendedorId) && (!e.loja || x.empresa === e.loja));
}

// ------------------------------------------------------------------ resumo do vendedor

export interface ResumoVendedor {
  hoje: string;
  mes: string;
  vendasMes: { valor: number; qtd: number };
  vendasMesAnterior: { valor: number; qtd: number };
  metaMes: number | null;
  pctMeta: number | null;
  diasRestantesMes: number;
  faltaParaMeta: number | null;
  ritmoNecessarioDia: number | null;
  ticketMedio: number;
  pipeline: { etapa: string; qtd: number; valor: number }[];
  pipelineAbertoValor: number;
  pipelineAbertoQtd: number;
  oportunidadesParadas: { cliente: string; etapa: string; dias: number; valor: number }[];
  followupsVencidos: { nome: string; dias: number }[];
  esfriando: { nome: string; dias: number }[];
  semProximoContato: number;
  totalClientes: number;
  atividadesSemana: number;
  atividadesHoje: number;
  atividadesPorTipoSemana: { tipo: string; qtd: number }[];
  metaAtividadesSemana: number | null;
  compromissosHoje: { titulo: string; hora: string | null; cliente: string | null }[];
  compromissosAtrasados: number;
  proximosCompromissos: { titulo: string; data: string; hora: string | null }[];
  whatsAlertas: { nome: string; alerta: string }[];
  conversao90d: number | null;
  ranking: { posicao: number | null; total: number; lider: string | null; distanciaProximo: number | null };
}

export function resumoVendedor(d: DadosCrm, vendedorId: string, agora = Date.now()): ResumoVendedor {
  const hoje = diaSP(agora);
  const mes = mesSP(agora);
  const mesAnt = mesAnterior(mes);
  const e: Escopo = { vendedorId };

  const vendas = noEscopo(d.vendas, e);
  const doMes = vendas.filter((v) => v.data?.slice(0, 7) === mes);
  const doMesAnt = vendas.filter((v) => v.data?.slice(0, 7) === mesAnt);
  const valorMes = doMes.reduce((s, v) => s + valorVenda(v), 0);

  const meta = d.metas.find((m) => m.owner_id === vendedorId && m.mes === mes)?.valor_meta ?? null;
  const diaDoMes = Number(hoje.slice(8, 10));
  const diasRestantes = Math.max(0, diasNoMes(mes) - diaDoMes + 1);
  const falta = meta != null ? Math.max(0, meta - valorMes) : null;

  const ops = noEscopo(d.oportunidades, e);
  const abertas = ops.filter((o) => ETAPAS_ABERTAS.includes(o.etapa));
  const pipeline = ETAPAS.map((etapa) => {
    const l = ops.filter((o) => o.etapa === etapa);
    return { etapa, qtd: l.length, valor: l.reduce((s, o) => s + (o.valor || 0), 0) };
  });
  const paradas = abertas
    .map((o) => ({ cliente: o.cliente, etapa: o.etapa, dias: diasDesde(o.updated_at ?? o.created_at, agora) ?? 0, valor: o.valor }))
    .filter((o) => o.dias >= 7)
    .sort((a, b) => b.valor - a.valor || b.dias - a.dias);

  const rels = noEscopo(d.relacionamentos, e);
  const vencidos = rels
    .filter((r) => r.proximo_contato_em && new Date(r.proximo_contato_em).getTime() < agora - DIA / 2)
    .map((r) => ({ nome: r.nome, dias: diasDesde(r.proximo_contato_em, agora) ?? 0 }))
    .sort((a, b) => b.dias - a.dias);
  const esfriando = rels
    .map((r) => ({ nome: r.nome, dias: diasDesde(r.ultimo_contato_em ?? r.created_at, agora) ?? 0 }))
    .filter((r) => r.dias >= 15)
    .sort((a, b) => b.dias - a.dias);

  const ativs = noEscopo(d.atividades, e).filter(ehAtividadeDoVendedor);
  const semana = ativs.filter((a) => agora - new Date(quandoAtiv(a)).getTime() <= 7 * DIA);
  const porTipo = new Map<string, number>();
  for (const a of semana) porTipo.set(a.tipo, (porTipo.get(a.tipo) ?? 0) + 1);
  const metaAtivSemana = d.metasAtividade
    .filter((m) => m.vendedor_id === vendedorId && (m.periodo ?? "semanal").toLowerCase().startsWith("seman"))
    .reduce((s, m) => s + m.quantidade, 0);

  const comps = d.compromissos.filter((c) => c.owner_id === vendedorId);
  const compHoje = comps.filter((c) => c.data === hoje && !c.concluido).sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? ""));
  const atrasados = comps.filter((c) => c.data < hoje && !c.concluido).length;
  const proximos = comps
    .filter((c) => c.data > hoje && !c.concluido)
    .sort((a, b) => a.data.localeCompare(b.data) || (a.hora ?? "").localeCompare(b.hora ?? ""))
    .slice(0, 5)
    .map((c) => ({ titulo: c.titulo, data: c.data, hora: c.hora }));

  const whats = d.leadsWhats
    .filter((l) => l.owner_id === vendedorId && l.alertas.length > 0)
    .map((l) => ({ nome: l.nome ?? "Contato", alerta: l.alertas[0] }));

  const noventa = ops.filter((o) => agora - new Date(o.updated_at ?? o.created_at).getTime() <= 90 * DIA);
  const fech = noventa.filter((o) => o.etapa === "Fechados").length;
  const perd = noventa.filter((o) => o.etapa === "Perdidos").length;

  // Ranking na loja do vendedor, pelo valor vendido no mês.
  const perfil = d.perfis.find((p) => p.id === vendedorId);
  const colegas = d.perfis.filter(
    (p) => p.empresa === perfil?.empresa && p.ativo !== false && /vendedor/i.test(p.cargo ?? ""),
  );
  const placar = colegas
    .map((p) => ({
      id: p.id,
      nome: p.nome,
      valor: d.vendas
        .filter((v) => v.owner_id === p.id && v.data?.slice(0, 7) === mes)
        .reduce((s, v) => s + valorVenda(v), 0),
    }))
    .sort((a, b) => b.valor - a.valor);
  const pos = placar.findIndex((p) => p.id === vendedorId);

  return {
    hoje,
    mes,
    vendasMes: { valor: valorMes, qtd: doMes.length },
    vendasMesAnterior: { valor: doMesAnt.reduce((s, v) => s + valorVenda(v), 0), qtd: doMesAnt.length },
    metaMes: meta,
    pctMeta: meta ? Math.round((valorMes / meta) * 100) : null,
    diasRestantesMes: diasRestantes,
    faltaParaMeta: falta,
    ritmoNecessarioDia: falta != null && diasRestantes > 0 ? Math.ceil(falta / diasRestantes) : null,
    ticketMedio: doMes.length ? Math.round(valorMes / doMes.length) : 0,
    pipeline,
    pipelineAbertoValor: abertas.reduce((s, o) => s + (o.valor || 0), 0),
    pipelineAbertoQtd: abertas.length,
    oportunidadesParadas: paradas.slice(0, 8),
    followupsVencidos: vencidos.slice(0, 8),
    esfriando: esfriando.slice(0, 8),
    semProximoContato: rels.filter((r) => !r.proximo_contato_em).length,
    totalClientes: rels.length,
    atividadesSemana: semana.length,
    atividadesHoje: ativs.filter((a) => diaSP(quandoAtiv(a)) === hoje).length,
    atividadesPorTipoSemana: [...porTipo.entries()].map(([tipo, qtd]) => ({ tipo, qtd })).sort((a, b) => b.qtd - a.qtd),
    metaAtividadesSemana: metaAtivSemana || null,
    compromissosHoje: compHoje.map((c) => ({ titulo: c.titulo, hora: c.hora, cliente: c.relacionamento_nome })),
    compromissosAtrasados: atrasados,
    proximosCompromissos: proximos,
    whatsAlertas: whats.slice(0, 8),
    conversao90d: fech + perd > 0 ? Math.round((fech / (fech + perd)) * 100) : null,
    ranking: {
      posicao: pos >= 0 ? pos + 1 : null,
      total: placar.length,
      lider: placar[0]?.nome ?? null,
      distanciaProximo: pos > 0 ? Math.max(0, placar[pos - 1].valor - placar[pos].valor) : null,
    },
  };
}

// ------------------------------------------------------------------ cartões e recados por página

export type Pagina =
  | "meu-dia"
  | "agenda"
  | "relacionamentos"
  | "pipeline"
  | "vendas"
  | "atividades"
  | "relatorio"
  | "ranking"
  | "whatsapp"
  | "gestor";

export interface Kpi {
  label: string;
  valor: string;
  tom?: "bom" | "atencao" | "ruim" | "neutro";
}

export interface Insight {
  tipo: "alerta" | "oportunidade" | "dica" | "conquista";
  titulo: string;
  detalhe?: string;
  acao?: { label: string; href: string };
}

export function kpisDaPagina(p: Pagina, r: ResumoVendedor): Kpi[] {
  const meta: Kpi = {
    label: "Meta do mês",
    valor: r.pctMeta != null ? `${r.pctMeta}%` : "sem meta",
    tom: r.pctMeta == null ? "neutro" : r.pctMeta >= 100 ? "bom" : r.pctMeta >= 60 ? "atencao" : "ruim",
  };
  const vendido: Kpi = { label: "Vendido no mês", valor: moeda(r.vendasMes.valor), tom: "neutro" };
  const pipe: Kpi = { label: "Pipeline aberto", valor: moeda(r.pipelineAbertoValor), tom: "neutro" };
  const ativ: Kpi = {
    label: "Atividades na semana",
    valor: r.metaAtividadesSemana ? `${r.atividadesSemana}/${r.metaAtividadesSemana}` : String(r.atividadesSemana),
    tom: r.metaAtividadesSemana ? (r.atividadesSemana >= r.metaAtividadesSemana ? "bom" : "atencao") : "neutro",
  };
  const follow: Kpi = { label: "Follow-ups vencidos", valor: String(r.followupsVencidos.length), tom: r.followupsVencidos.length ? "ruim" : "bom" };
  const paradas: Kpi = { label: "Negócios parados", valor: String(r.oportunidadesParadas.length), tom: r.oportunidadesParadas.length ? "atencao" : "bom" };
  const whats: Kpi = { label: "WhatsApp esperando", valor: String(r.whatsAlertas.length), tom: r.whatsAlertas.length ? "ruim" : "bom" };
  const rank: Kpi = {
    label: "Posição no ranking",
    valor: r.ranking.posicao ? `${r.ranking.posicao}º de ${r.ranking.total}` : "—",
    tom: r.ranking.posicao === 1 ? "bom" : "neutro",
  };
  const conv: Kpi = { label: "Conversão (90 dias)", valor: r.conversao90d != null ? `${r.conversao90d}%` : "—", tom: "neutro" };

  switch (p) {
    case "meu-dia":
      return [meta, follow, whats, { label: "Compromissos hoje", valor: String(r.compromissosHoje.length), tom: "neutro" }];
    case "agenda":
      return [
        { label: "Hoje", valor: String(r.compromissosHoje.length), tom: "neutro" },
        { label: "Atrasados", valor: String(r.compromissosAtrasados), tom: r.compromissosAtrasados ? "ruim" : "bom" },
        follow,
        { label: "Clientes sem próximo contato", valor: String(r.semProximoContato), tom: r.semProximoContato ? "atencao" : "bom" },
      ];
    case "relacionamentos":
      return [
        { label: "Clientes", valor: String(r.totalClientes), tom: "neutro" },
        { label: "Esfriando (15+ dias)", valor: String(r.esfriando.length), tom: r.esfriando.length ? "atencao" : "bom" },
        follow,
        { label: "Sem próximo contato", valor: String(r.semProximoContato), tom: r.semProximoContato ? "atencao" : "bom" },
      ];
    case "pipeline":
      return [pipe, { label: "Negócios abertos", valor: String(r.pipelineAbertoQtd), tom: "neutro" }, paradas, conv];
    case "vendas":
      return [vendido, meta, { label: "Ticket médio", valor: moeda(r.ticketMedio), tom: "neutro" }, rank];
    case "atividades":
      return [ativ, { label: "Hoje", valor: String(r.atividadesHoje), tom: r.atividadesHoje ? "bom" : "atencao" }, follow, whats];
    case "ranking":
      return [rank, vendido, meta, ativ];
    case "whatsapp":
      return [whats, follow, paradas, pipe];
    default:
      return [vendido, meta, pipe, ativ];
  }
}

/** Recados automáticos (usados quando a IA está fora do ar e como base para ela). */
export function insightsRegras(p: Pagina, r: ResumoVendedor): Insight[] {
  const out: Insight[] = [];
  const add = (i: Insight) => out.push(i);

  if (r.whatsAlertas.length && ["meu-dia", "whatsapp", "atividades", "relacionamentos"].includes(p)) {
    add({
      tipo: "alerta",
      titulo: `${r.whatsAlertas.length} cliente(s) esperando no WhatsApp`,
      detalhe: `${r.whatsAlertas[0].nome}: ${r.whatsAlertas[0].alerta}`,
      acao: { label: "Responder agora", href: "/whatsapp" },
    });
  }
  if (r.followupsVencidos.length && p !== "pipeline" && p !== "vendas") {
    add({
      tipo: "alerta",
      titulo: `${r.followupsVencidos.length} follow-up(s) atrasado(s)`,
      detalhe: r.followupsVencidos.slice(0, 3).map((f) => f.nome).join(", "),
      acao: { label: "Ver clientes", href: "/relacionamentos" },
    });
  }
  if (r.oportunidadesParadas.length && ["pipeline", "meu-dia", "vendas", "relatorio"].includes(p)) {
    const o = r.oportunidadesParadas[0];
    add({
      tipo: "oportunidade",
      titulo: `${o.cliente} parado em ${o.etapa} há ${o.dias} dias`,
      detalhe: o.valor ? `${moeda(o.valor)} em jogo — faça contato hoje.` : "Faça contato hoje para não perder.",
      acao: { label: "Abrir pipeline", href: "/pipeline" },
    });
  }
  if (r.compromissosAtrasados && ["agenda", "meu-dia"].includes(p)) {
    add({ tipo: "alerta", titulo: `${r.compromissosAtrasados} compromisso(s) atrasado(s)`, acao: { label: "Ver agenda", href: "/agenda" } });
  }
  if (r.esfriando.length && ["relacionamentos", "agenda", "meu-dia"].includes(p)) {
    add({
      tipo: "dica",
      titulo: `${r.esfriando.length} cliente(s) esfriando`,
      detalhe: `${r.esfriando[0].nome} está há ${r.esfriando[0].dias} dias sem contato.`,
      acao: { label: "Chamar no WhatsApp", href: "/whatsapp" },
    });
  }
  if (r.metaMes && r.faltaParaMeta && ["vendas", "meu-dia", "ranking", "relatorio"].includes(p)) {
    add({
      tipo: r.pctMeta! >= 100 ? "conquista" : "dica",
      titulo: r.pctMeta! >= 100 ? "Meta do mês batida! 🎉" : `Faltam ${moeda(r.faltaParaMeta)} para a meta`,
      detalhe: r.pctMeta! >= 100 ? undefined : `Ritmo: ${moeda(r.ritmoNecessarioDia ?? 0)} por dia nos próximos ${r.diasRestantesMes} dias.`,
    });
  }
  if (r.ranking.posicao && r.ranking.posicao > 1 && r.ranking.distanciaProximo != null && ["ranking", "vendas"].includes(p)) {
    add({
      tipo: "oportunidade",
      titulo: `${moeda(r.ranking.distanciaProximo)} para subir uma posição`,
      detalhe: r.oportunidadesParadas[0] ? `Fechar ${r.oportunidadesParadas[0].cliente} resolve.` : undefined,
    });
  }
  if (r.metaAtividadesSemana && r.atividadesSemana < r.metaAtividadesSemana && ["atividades", "meu-dia"].includes(p)) {
    add({
      tipo: "dica",
      titulo: `Faltam ${r.metaAtividadesSemana - r.atividadesSemana} atividades na semana`,
      acao: { label: "Registrar atividade", href: "/registrar-atividade" },
    });
  }
  if (!out.length) add({ tipo: "conquista", titulo: "Tudo em dia por aqui 👏", detalhe: "Nenhum cliente esperando e nenhum negócio parado." });
  return out.slice(0, 4);
}

// ------------------------------------------------------------------ relatório (séries para gráficos)

export interface Relatorio {
  periodoDias: number;
  kpis: { vendido: number; qtdVendas: number; ticket: number; atividades: number; novosClientes: number; conversao: number | null; pipelineAberto: number };
  vendasPorDia: { dia: string; valor: number }[];
  atividadesPorDia: { dia: string; qtd: number }[];
  atividadesPorTipo: { tipo: string; qtd: number }[];
  funil: { etapa: string; qtd: number; valor: number }[];
  porVendedor: { id: string; nome: string; loja: string; vendido: number; vendas: number; atividades: number; pipeline: number }[];
  porLoja: { loja: string; vendido: number; vendas: number; atividades: number; pipeline: number; clientes: number }[];
  topClientes: { cliente: string; valor: number }[];
}

export function montarRelatorio(d: DadosCrm, e: Escopo, periodoDias: number, agora = Date.now()): Relatorio {
  const inicio = agora - periodoDias * DIA;
  const noPeriodo = (iso: string) => new Date(iso).getTime() >= inicio;

  const vendas = noEscopo(d.vendas, e).filter((v) => noPeriodo(`${v.data}T12:00:00-03:00`));
  const ativs = noEscopo(d.atividades, e).filter((a) => ehAtividadeDoVendedor(a) && noPeriodo(quandoAtiv(a)));
  const ops = noEscopo(d.oportunidades, e);
  const rels = noEscopo(d.relacionamentos, e);

  const dias: string[] = [];
  for (let t = inicio + DIA; t <= agora; t += DIA) dias.push(diaSP(t));
  if (dias[dias.length - 1] !== diaSP(agora)) dias.push(diaSP(agora));

  const vendasDia = new Map<string, number>();
  for (const v of vendas) vendasDia.set(v.data, (vendasDia.get(v.data) ?? 0) + valorVenda(v));
  const ativDia = new Map<string, number>();
  for (const a of ativs) {
    const k = diaSP(quandoAtiv(a));
    ativDia.set(k, (ativDia.get(k) ?? 0) + 1);
  }
  const porTipo = new Map<string, number>();
  for (const a of ativs) porTipo.set(a.tipo, (porTipo.get(a.tipo) ?? 0) + 1);

  const opsPeriodo = ops.filter((o) => noPeriodo(o.updated_at ?? o.created_at));
  const fech = opsPeriodo.filter((o) => o.etapa === "Fechados").length;
  const perd = opsPeriodo.filter((o) => o.etapa === "Perdidos").length;

  const vendido = vendas.reduce((s, v) => s + valorVenda(v), 0);

  const vendedores = d.perfis.filter(
    (p) => (!e.loja || p.empresa === e.loja) && (!e.vendedorId || p.id === e.vendedorId) && /vendedor/i.test(p.cargo ?? ""),
  );
  const porVendedor = vendedores
    .map((p) => ({
      id: p.id,
      nome: p.nome,
      loja: p.empresa,
      vendido: vendas.filter((v) => v.owner_id === p.id).reduce((s, v) => s + valorVenda(v), 0),
      vendas: vendas.filter((v) => v.owner_id === p.id).length,
      atividades: ativs.filter((a) => a.owner_id === p.id).length,
      pipeline: ops.filter((o) => o.owner_id === p.id && ETAPAS_ABERTAS.includes(o.etapa)).reduce((s, o) => s + o.valor, 0),
    }))
    .sort((a, b) => b.vendido - a.vendido || b.atividades - a.atividades);

  const lojas = [...new Set([...d.perfis.map((p) => p.empresa), ...rels.map((r) => r.empresa)])].filter(
    (l) => l && (!e.loja || l === e.loja),
  );
  const porLoja = lojas
    .map((loja) => ({
      loja,
      vendido: vendas.filter((v) => v.empresa === loja).reduce((s, v) => s + valorVenda(v), 0),
      vendas: vendas.filter((v) => v.empresa === loja).length,
      atividades: ativs.filter((a) => a.empresa === loja).length,
      pipeline: ops.filter((o) => o.empresa === loja && ETAPAS_ABERTAS.includes(o.etapa)).reduce((s, o) => s + o.valor, 0),
      clientes: rels.filter((r) => r.empresa === loja).length,
    }))
    .sort((a, b) => b.vendido - a.vendido);

  const porCliente = new Map<string, number>();
  for (const v of vendas) porCliente.set(v.cliente, (porCliente.get(v.cliente) ?? 0) + valorVenda(v));

  return {
    periodoDias,
    kpis: {
      vendido,
      qtdVendas: vendas.length,
      ticket: vendas.length ? Math.round(vendido / vendas.length) : 0,
      atividades: ativs.length,
      novosClientes: rels.filter((r) => noPeriodo(r.created_at)).length,
      conversao: fech + perd ? Math.round((fech / (fech + perd)) * 100) : null,
      pipelineAberto: ops.filter((o) => ETAPAS_ABERTAS.includes(o.etapa)).reduce((s, o) => s + o.valor, 0),
    },
    vendasPorDia: dias.map((dia) => ({ dia, valor: vendasDia.get(dia) ?? 0 })),
    atividadesPorDia: dias.map((dia) => ({ dia, qtd: ativDia.get(dia) ?? 0 })),
    atividadesPorTipo: [...porTipo.entries()].map(([tipo, qtd]) => ({ tipo, qtd })).sort((a, b) => b.qtd - a.qtd),
    funil: ETAPAS.map((etapa) => {
      const l = ops.filter((o) => o.etapa === etapa);
      return { etapa, qtd: l.length, valor: l.reduce((s, o) => s + o.valor, 0) };
    }),
    porVendedor,
    porLoja,
    topClientes: [...porCliente.entries()].map(([cliente, valor]) => ({ cliente, valor })).sort((a, b) => b.valor - a.valor).slice(0, 5),
  };
}

// ------------------------------------------------------------------ visão do gestor

export interface VendedorRisco {
  id: string;
  nome: string;
  loja: string;
  vendidoMes: number;
  metaMes: number | null;
  pctMeta: number | null;
  atividadesSemana: number;
  followupsVencidos: number;
  paradas: number;
  whatsEsperando: number;
  diasSemAtividade: number | null;
  status: "bom" | "atencao" | "critico";
}

export function painelGestor(d: DadosCrm, loja?: string, agora = Date.now()) {
  const vendedores = d.perfis.filter((p) => (!loja || p.empresa === loja) && /vendedor/i.test(p.cargo ?? "") && p.ativo !== false);
  const lista: VendedorRisco[] = vendedores.map((p) => {
    const r = resumoVendedor(d, p.id, agora);
    const ultimaAtiv = d.atividades
      .filter((a) => a.owner_id === p.id && ehAtividadeDoVendedor(a))
      .map((a) => new Date(quandoAtiv(a)).getTime())
      .sort((a, b) => b - a)[0];
    const semAtiv = ultimaAtiv ? Math.floor((agora - ultimaAtiv) / DIA) : null;
    const pontos =
      (r.whatsAlertas.length ? 2 : 0) +
      (r.followupsVencidos.length > 3 ? 2 : r.followupsVencidos.length ? 1 : 0) +
      (r.oportunidadesParadas.length > 3 ? 1 : 0) +
      (semAtiv == null || semAtiv >= 3 ? 2 : 0) +
      (r.pctMeta != null && r.pctMeta < 50 && r.diasRestantesMes < 12 ? 2 : 0);
    return {
      id: p.id,
      nome: p.nome,
      loja: p.empresa,
      vendidoMes: r.vendasMes.valor,
      metaMes: r.metaMes,
      pctMeta: r.pctMeta,
      atividadesSemana: r.atividadesSemana,
      followupsVencidos: r.followupsVencidos.length,
      paradas: r.oportunidadesParadas.length,
      whatsEsperando: r.whatsAlertas.length,
      diasSemAtividade: semAtiv,
      status: pontos >= 4 ? "critico" : pontos >= 2 ? "atencao" : "bom",
    };
  });

  const nomeDono = new Map(d.perfis.map((p) => [p.id, p.nome]));
  const leadsEmRisco = [
    ...d.leadsWhats
      .filter((l) => l.alertas.length && (!loja || vendedores.some((v) => v.id === l.owner_id)))
      .map((l) => ({ cliente: l.nome ?? "Contato", vendedor: nomeDono.get(l.owner_id) ?? "—", motivo: l.alertas[0], origem: "WhatsApp" })),
    ...d.oportunidades
      .filter((o) => (!loja || o.empresa === loja) && ETAPAS_ABERTAS.includes(o.etapa))
      .map((o) => ({ o, dias: diasDesde(o.updated_at ?? o.created_at, agora) ?? 0 }))
      .filter(({ dias }) => dias >= 10)
      .sort((a, b) => b.o.valor - a.o.valor)
      .slice(0, 10)
      .map(({ o, dias }) => ({
        cliente: o.cliente,
        vendedor: nomeDono.get(o.owner_id) ?? "—",
        motivo: `Parado em ${o.etapa} há ${dias} dias${o.valor ? ` (${moeda(o.valor)})` : ""}`,
        origem: "Pipeline",
      })),
  ].slice(0, 15);

  return {
    vendedores: lista.sort((a, b) => ({ critico: 0, atencao: 1, bom: 2 })[a.status] - ({ critico: 0, atencao: 1, bom: 2 })[b.status] || b.vendidoMes - a.vendidoMes),
    leadsEmRisco,
    lojas: [...new Set(d.perfis.map((p) => p.empresa))].filter(Boolean).sort(),
  };
}
