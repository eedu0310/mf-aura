/**
 * Teste do relatório detalhado (src/lib/aura/relatorio-detalhado.ts).
 * Rodar: npx tsx src/lib/aura/relatorio-detalhado.teste.ts
 */
import { FUNIL_PADRAO } from "../funil";
import type { DadosCrm } from "./dados";
import { montarRelatorioDetalhado, montarRelatorioDetalhadoJanela, type PosVendaResumo } from "./relatorio-detalhado";

let falhas = 0;
let total = 0;
function igual(a: unknown, b: unknown, o_que: string) {
  total++;
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    falhas++;
    console.error(`  FALHOU: ${o_que} (deu ${JSON.stringify(a)}, esperava ${JSON.stringify(b)})`);
  }
}

// "Agora" fixo: 20/11/2026 meio-dia em São Paulo.
const AGORA = Date.parse("2026-11-20T12:00:00-03:00");
const dia = (d: string) => `${d}T12:00:00-03:00`;

const perfil = (id: string, nome: string, empresa = "MF", cargo = "Vendedor") => ({
  id, nome, empresa, cargo, ativo: true,
});

const d: DadosCrm = {
  perfil: perfil("g", "Gestor", "MF", "Gestor"),
  perfis: [perfil("a", "Ana"), perfil("b", "Bruno"), { ...perfil("x", "Saiu"), ativo: false }],
  relacionamentos: [
    { id: "r1", owner_id: "a", empresa: "MF", nome: "C1", temperatura: null, ultimo_contato_em: null, proximo_contato_em: null, created_at: dia("2026-11-01") },
    { id: "r2", owner_id: "b", empresa: "MF", nome: "C2", temperatura: null, ultimo_contato_em: null, proximo_contato_em: null, created_at: dia("2026-08-01") },
  ],
  oportunidades: [
    // Ana: ganhou uma (aberta em 01/11, venda 11/11 = 10 dias), perdeu uma.
    { id: "o1", owner_id: "a", empresa: "MF", cliente: "C1", valor: 9000, etapa: "Fechamento", created_at: dia("2026-11-05"), updated_at: dia("2026-11-11"), relacionamento_id: "r1" },
    { id: "o2", owner_id: "a", empresa: "MF", cliente: "C3", valor: 5000, etapa: "Perdidos", created_at: dia("2026-11-02"), updated_at: dia("2026-11-10"), relacionamento_id: null },
    // Bruno: venda desfeita (negócio voltou para Perdidos), cadastrado no dia.
    { id: "o3", owner_id: "b", empresa: "MF", cliente: "C2", valor: 4000, etapa: "Perdidos", created_at: dia("2026-11-15"), updated_at: dia("2026-11-16"), relacionamento_id: null },
    { id: "o4", owner_id: "b", empresa: "MF", cliente: "C4", valor: 1000, etapa: "Prospecção", created_at: dia("2026-11-18"), updated_at: null, relacionamento_id: null },
  ],
  atividades: [],
  vendas: [
    { id: "v1", owner_id: "a", empresa: "MF", cliente: "C1", valor: 9000, valor_fechado: 9000, valor_original: 10000, data: "2026-11-11", status: "fechada", parceiro_id: null, percentual_parceiro: null, oportunidade_id: "o1", relacionamento_id: "r1" },
    { id: "v2", owner_id: "b", empresa: "MF", cliente: "C2", valor: 4000, valor_fechado: 4000, valor_original: null, data: "2026-11-15", status: "fechada", parceiro_id: null, percentual_parceiro: null, oportunidade_id: "o3", relacionamento_id: null },
    // Fora do período de 30 dias, mas no mês? Não: outubro. Não entra em nada do período.
    { id: "v3", owner_id: "a", empresa: "MF", cliente: "C9", valor: 2000, valor_fechado: 2000, valor_original: 2000, data: "2026-10-01", status: "fechada", parceiro_id: null, percentual_parceiro: null },
  ],
  compromissos: [],
  metas: [
    { owner_id: "a", mes: "2026-11", valor_meta: 18000, empresa: "MF" },
    { owner_id: "b", mes: "2026-11", valor_meta: 8000, empresa: "MF" },
    { owner_id: "x", mes: "2026-11", valor_meta: 99999, empresa: "MF" },
  ],
  metasAtividade: [],
  leadsWhats: [],
  funil: FUNIL_PADRAO,
};

const pos: PosVendaResumo[] = [
  { vendedor_id: "a", empresa: "MF", nota: 5, reclamacao: false, criado_em: dia("2026-11-12"), reclamacao_em: null },
  { vendedor_id: "a", empresa: "MF", nota: 4, reclamacao: true, criado_em: dia("2026-11-12"), reclamacao_em: dia("2026-11-14") },
  { vendedor_id: "b", empresa: "MF", nota: null, reclamacao: false, criado_em: dia("2026-11-16"), reclamacao_em: null },
];

const r = montarRelatorioDetalhado(d, {}, 30, pos, AGORA);
const ana = r.porVendedor.find((v) => v.id === "a")!;
const bruno = r.porVendedor.find((v) => v.id === "b")!;

console.log("Relatório detalhado:");
igual(r.mes, "2026-11", "mês corrente em São Paulo");
igual(r.porVendedor.map((v) => v.id), ["a", "b"], "só vendedores ativos, ordenados por receita");

igual(r.geral.receita, 13000, "receita da loja (só as vendas do período)");
igual(ana.receita, 9000, "receita da Ana");
igual(r.geral.ticket, 6500, "ticket médio da loja");

igual(ana.prospeccoes, 2, "prospecções da Ana: negócios abertos no período");
igual(bruno.prospeccoes, 2, "prospecções do Bruno");
igual(ana.clientesNovos, 1, "clientes novos da Ana");

igual(ana.conversao, 50, "conversão da Ana: 1 ganho, 1 perda");
igual(r.geral.conversao, 33, "conversão da loja: 1 ganho, 2 perdas");

igual(ana.precoMantido, 90, "Ana manteve 90% do preço de tabela");
igual(ana.descontoMedio, 10, "desconto médio da Ana");
igual(ana.descontoTotal, 1000, "desconto total da Ana em R$");
igual(bruno.precoMantido, null, "sem preço de tabela não inventa margem");

igual(ana.cicloMedio, 10, "ciclo: do cadastro do cliente (01/11) até a venda (11/11)");
igual(bruno.cicloMedio, 0, "ciclo do Bruno: negócio cadastrado no dia da venda");
igual(bruno.cadastradasNoFechamento, 1, "conta as vendas cadastradas só no fechamento");

igual(bruno.canceladas, 1, "venda cujo negócio voltou para Perdidos é cancelamento");
igual(bruno.taxaCancelamento, 100, "taxa de cancelamento do Bruno");
igual(r.geral.taxaCancelamento, 50, "taxa de cancelamento da loja");

igual(ana.metaMes, 18000, "meta da Ana no mês");
igual(ana.atingimento, 50, "Ana atingiu 50% da meta");
igual(r.geral.metaMes, 26000, "meta da loja sem quem saiu da empresa");
igual(r.geral.atingimento, 50, "atingimento da loja");

igual(ana.notaMedia, 4.5, "nota média da Ana");
igual(ana.avaliacoes, 2, "avaliações da Ana");
igual(ana.reclamacoes, 1, "reclamações da Ana");
igual(bruno.notaMedia, null, "sem nota, sem média");

const soAna = montarRelatorioDetalhado(d, { vendedorId: "a" }, 30, pos, AGORA);
igual(soAna.porVendedor.length, 1, "vendedor vê só a si mesmo");
igual(soAna.geral.metaMes, 18000, "meta do recorte de um vendedor é só a dele");

const semana = montarRelatorioDetalhadoJanela(d, {}, Date.parse(dia("2026-11-10")), Date.parse(dia("2026-11-12")), pos);
igual(semana.geral.receita, 9000, "janela fechada: só a venda de 11/11 (a de 15/11 fica de fora)");
igual(semana.geral.prospeccoes, 0, "janela fechada: negócios abertos fora da janela não contam");
igual(semana.mes, "2026-11", "meta do mês em que a janela termina");

console.log(`  ${total - falhas}/${total} conferências ok`);
if (falhas) process.exit(1);
