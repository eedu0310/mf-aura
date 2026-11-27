/**
 * A nota do ranking (revisão de 27/11/2026).
 *
 * Rodar com:
 *   node --experimental-strip-types --no-warnings --import <reg.mjs> src/lib/ranking/nota.teste.ts
 */
import { calcularNota, type Criterio, type Insumos } from "./nota";

let passou = 0;
const falhas: string[] = [];
function conferir(oque: string, real: unknown, esperado: unknown) {
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a === b) passou += 1;
  else falhas.push(`${oque}\n  esperado: ${b}\n  veio:     ${a}`);
}

const DESDE = "2026-11-01T03:00:00.000Z";
const P = { id: "p1", nome: "Jeferson", loja: "LF Lareiras" };
const crit = (medida: string, peso: number, meta: number, extra: Partial<Criterio> = {}): Criterio => ({
  id: medida,
  medida,
  titulo: medida,
  descricao: null,
  peso,
  meta_mes: meta,
  categoria_alvo: null,
  ativo: true,
  ordem: 1,
  ...extra,
});
const base = (): Insumos => ({
  vendas: [],
  vendasAnteriores: [],
  relacionamentos: [],
  atividades: [],
  avaliacoes: [],
  oportunidades: [],
});
const feito = (medida: string, d: Insumos, extra: Partial<Criterio> = {}) =>
  calcularNota(P, [crit(medida, 1, 1, extra)], d, DESDE, 80).parcelas[0];

// ---- avaliações pela data do envio/abertura (o bug: filtrava pela data da venda)
{
  const d = base();
  d.avaliacoes = [
    { vendedor_id: "p1", enviado_em: "2026-11-23T12:00:00Z", aberto_em: null, confirmado_em: null }, // venda de outubro, enviada em novembro
    { vendedor_id: "p1", enviado_em: "2026-10-20T12:00:00Z", aberto_em: null, confirmado_em: null }, // enviada em outubro
    { vendedor_id: "p1", enviado_em: null, aberto_em: "2026-11-23T15:00:00Z", confirmado_em: null }, // aberta sem envio registrado
  ];
  conferir("enviadas no mês (inclui aberta sem envio registrado)", feito("avaliacao_enviada", d).feito, 2);
  conferir("recebidas no mês", feito("avaliacao_conquistada", d).feito, 1);
}

// ---- negociação saiu: critério antigo no banco é ignorado
{
  const nota = calcularNota(P, [crit("negociacao", 2, 5), crit("venda_nova", 1, 1)], base(), DESDE, 80);
  conferir("negociação não entra na nota", nota.parcelas.map((p) => p.titulo), ["venda_nova"]);
}

// ---- indicação: um por cliente
{
  const d = base();
  d.atividades = [
    { owner_id: "p1", tipo: "Visita", origem: "Indicação", relacionamento_id: "r1" },
    { owner_id: "p1", tipo: "Ligação", origem: "Indicação", relacionamento_id: "r1" },
    { owner_id: "p1", tipo: "Visita", origem: "Indicação", cliente_nome: "Ana" },
    { owner_id: "p1", tipo: "Visita", origem: "Loja", relacionamento_id: "r9" },
  ];
  conferir("indicação conta cliente, não atividade", feito("indicacao", d).feito, 2);
}

// ---- prospecção: não conta contato do WhatsApp nem cadastro na hora da venda
{
  const d = base();
  d.relacionamentos = [
    { id: "r1", owner_id: "p1", categoria: "Arquiteto", proximo_contato_em: null, ultimo_contato_em: null, created_at: "2026-11-05T12:00:00Z", origem: "Cadastro" },
    { id: "r2", owner_id: "p1", categoria: "Cliente Final", proximo_contato_em: null, ultimo_contato_em: null, created_at: "2026-11-06T12:00:00Z", origem: "WhatsApp" },
    { id: "r3", owner_id: "p1", categoria: "Cliente Final", proximo_contato_em: null, ultimo_contato_em: null, created_at: "2026-11-10T13:00:00Z", origem: null },
    { id: "r4", owner_id: "p1", categoria: "Cliente Final", proximo_contato_em: null, ultimo_contato_em: null, created_at: "2026-11-07T12:00:00Z", origem_lead: "marketing" },
  ];
  d.vendas = [
    { owner_id: "p1", valor: 1000, valor_fechado: 1000, relacionamento_id: "r3", parceiro_id: null, percentual_parceiro: null, data: "2026-11-10" },
    { owner_id: "p1", valor: 2000, valor_fechado: 2000, relacionamento_id: "r1", parceiro_id: null, percentual_parceiro: null, data: "2026-11-20" },
  ];
  d.atividades = [{ owner_id: "p1", tipo: "Prospecção", relacionamento_id: "r7" }];
  conferir("prospecção: r1 trazido + r7 prospectado (fora WhatsApp, cadastro na venda e anúncio)", feito("prospeccao", d).feito, 2);
  conferir("prospecção que fechou: só a venda do cliente trazido antes", feito("prospeccao_fechada", d).feito, 1);
  conferir("ticket médio", feito("ticket_medio", d).feito, 1500);
}

// ---- KPIs: inverso e sem dado
{
  const d = base();
  const semVenda = calcularNota(P, [crit("ticket_medio", 1, 1000), crit("venda_nova", 1, 2)], d, DESDE, 80);
  conferir("sem venda: ticket fica fora da conta (não zera a nota)", semVenda.parcelas[0].semDado, true);
  d.vendas = [{ owner_id: "p1", valor: 100, valor_fechado: 100, relacionamento_id: null, parceiro_id: null, percentual_parceiro: null, status: "cancelada", data: "2026-11-02" }];
  conferir("cancelamento acima do teto 0 perde o ponto", feito("cancelamentos", d, { meta_mes: 0 }).pontos, 0);
  conferir("sem venda: cancelamento fica fora da conta (não ganha o ponto de graça)", feito("cancelamentos", base(), { meta_mes: 1 }).semDado, true);
  const ok = base();
  ok.vendas = [{ owner_id: "p1", valor: 100, valor_fechado: 100, relacionamento_id: null, parceiro_id: null, percentual_parceiro: null, status: "fechada", data: "2026-11-02" }];
  conferir("vendeu e não cancelou leva o ponto", feito("cancelamentos", ok, { meta_mes: 1 }).pontos, 1);
  const perdida = base();
  perdida.vendas = [{ owner_id: "p1", valor: 100, valor_fechado: 100, relacionamento_id: null, parceiro_id: null, percentual_parceiro: null, status: "fechada", data: "2026-11-02", oportunidade_id: "o1" }];
  perdida.oportunidades = [{ id: "o1", owner_id: "p1", relacionamento_id: null, etapa: "Perdidos" }];
  conferir("venda cujo negócio voltou para Perdidos conta como cancelada", feito("cancelamentos", perdida, { meta_mes: 1 }).feito, 1);
  const auto = base();
  auto.vendas = [{ owner_id: "p1", valor: 1000, valor_fechado: 1000, valor_original: 1000, relacionamento_id: null, parceiro_id: null, percentual_parceiro: null, status: "aguardando_detalhes", data: "2026-11-02" }];
  conferir("venda automática (sem detalhes) não entra em preço mantido", feito("preco_mantido", auto).semDado, true);
  const r = base();
  r.relacionamentos = [{ id: "r1", owner_id: "p1", categoria: null, proximo_contato_em: null, ultimo_contato_em: null, created_at: "2026-10-01T15:00:00Z" }];
  r.vendas = [{ owner_id: "p1", valor: 100, valor_fechado: 100, relacionamento_id: "r1", parceiro_id: null, percentual_parceiro: null, data: "2026-11-30" }];
  const ciclo = feito("ciclo_medio", r, { meta_mes: 30 });
  conferir("ciclo de 60 dias com teto 30 leva metade", [ciclo.feito, Math.round(ciclo.pontos * 100) / 100], [60, 0.5]);
  const v = base();
  v.vendas = [{ owner_id: "p1", valor: 900, valor_fechado: 900, valor_original: 1000, relacionamento_id: null, parceiro_id: null, percentual_parceiro: null, data: "2026-11-02" }];
  conferir("preço mantido", feito("preco_mantido", v).feito, 90);
  v.metaDeFaturamento = new Map([["p1", 1800]]);
  conferir("atingimento da meta", feito("atingimento_meta", v).feito, 50);
  const c = base();
  c.oportunidades = [
    { owner_id: "p1", relacionamento_id: null, etapa: "Fechamento", updated_at: "2026-11-05T12:00:00Z" },
    { owner_id: "p1", relacionamento_id: null, etapa: "Pós-venda", updated_at: "2026-11-06T12:00:00Z" },
    { owner_id: "p1", relacionamento_id: null, etapa: "Perdidos", updated_at: "2026-11-07T12:00:00Z" },
    { owner_id: "p1", relacionamento_id: null, etapa: "Perdidos", updated_at: "2026-10-07T12:00:00Z" },
  ];
  conferir("conversão: 2 ganhos, 1 perdido no mês", feito("conversao", c).feito, 67);
}

if (falhas.length) {
  console.error(`${falhas.length} verificação(ões) falharam:\n\n${falhas.join("\n\n")}`);
  process.exit(1);
}
console.log(`${passou}/${passou} verificações passaram`);
