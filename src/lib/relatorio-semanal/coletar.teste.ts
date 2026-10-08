/**
 * Teste do coletor do relatório semanal.
 *   npx tsx src/lib/relatorio-semanal/coletar.teste.ts
 *
 * O cliente do Supabase é dublado: o que está sendo provado é a lógica de
 * agrupamento, as bordas de data e a divisão do atendimento em dupla, sem
 * depender de rede nem de chave.
 */
import { coletarSemanaDaLoja } from "./coletar";

let ok = 0;
const falhas: string[] = [];
function conferir(desc: string, real: unknown, esperado: unknown) {
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a === b) ok++;
  else falhas.push(`${desc}\n    esperado: ${b}\n    recebido: ${a}`);
}

const SEMANA = { inicio: new Date("2026-10-01T00:00:00Z"), fim: new Date("2026-10-08T00:00:00Z") };
const ANA = "11111111-1111-1111-1111-111111111111";
const BRUNO = "22222222-2222-2222-2222-222222222222";
const CHEFE = "33333333-3333-3333-3333-333333333333";

const TABELAS: Record<string, Record<string, unknown>[]> = {
  profiles: [
    { id: ANA, nome: "Ana", cargo: "Vendedor" },
    { id: BRUNO, nome: "Bruno", cargo: "Vendedor Interno" },
    // Gestor sem atividade não entra; com atividade entra (caso MF International).
    { id: CHEFE, nome: "Chefe", cargo: "Gestor" },
  ],
  atividades: [
    // Dentro da semana, datada por ocorrida_em.
    { owner_id: ANA, tipo: "Visita", relacionamento_id: "r-arq", ocorrida_em: "2026-10-02T13:00:00Z" },
    { owner_id: ANA, tipo: "Visita", cliente_categoria: "Obra", ocorrida_em: "2026-10-03T13:00:00Z" },
    { owner_id: ANA, tipo: "Ligação", relacionamento_id: "r-arq", ocorrida_em: "2026-10-03T14:00:00Z" },
    { owner_id: ANA, tipo: "Orçamento", relacionamento_id: "r-fin", ocorrida_em: "2026-10-04T14:00:00Z" },
    // Lançada no sábado seguinte mas ocorrida na quinta: conta nesta semana.
    { owner_id: BRUNO, tipo: "Visita", relacionamento_id: "r-des", ocorrida_em: "2026-10-05T10:00:00Z" },
    // Fora da janela: não conta.
    { owner_id: ANA, tipo: "Visita", relacionamento_id: "r-arq", ocorrida_em: "2026-09-30T23:59:00Z" },
    { owner_id: ANA, tipo: "Visita", relacionamento_id: "r-arq", ocorrida_em: "2026-10-08T00:00:00Z" },
    { owner_id: CHEFE, tipo: "Prospecção", relacionamento_id: "r-fin", ocorrida_em: "2026-10-02T09:00:00Z" },
  ],
  relacionamentos: [
    { id: "r-arq", owner_id: ANA, categoria: "Arquiteto", created_at: "2026-10-02T12:00:00Z" },
    { id: "r-fin", owner_id: ANA, categoria: "Cliente Final", created_at: "2026-05-01T12:00:00Z" },
    { id: "r-des", owner_id: BRUNO, categoria: "Designer de Interiores", created_at: "2026-10-05T09:00:00Z" },
  ],
  oportunidades: [
    { owner_id: ANA, etapa: "Negociação", valor: 10000, created_at: "2026-10-02T12:00:00Z" },
    { owner_id: ANA, etapa: "Fechamento", valor: 5000, created_at: "2026-10-03T12:00:00Z" },
    { owner_id: ANA, etapa: "Perdidos", valor: 3000, created_at: "2026-09-01T12:00:00Z", data_perda: "2026-10-04" },
    { owner_id: BRUNO, etapa: "Proposta", valor: 7000, created_at: "2026-08-01T12:00:00Z" },
  ],
  vendas: [
    // Venda da Ana com Bruno como parceiro em 30%: Ana 7000, Bruno 3000.
    { owner_id: ANA, valor: 10000, valor_fechado: 10000, data: "2026-10-03", parceiro_id: BRUNO, percentual_parceiro: 30 },
    // Fora do período.
    { owner_id: ANA, valor: 90000, valor_fechado: 90000, data: "2026-09-20", parceiro_id: null },
  ],
  whatsapp_ia_leads: [
    {
      owner_id: ANA, nome: "Cliente A", etapa: "Negociação",
      alertas: ["Cliente sem resposta há 3 dias", "Orçamento não enviado"],
      dicas: ["Enviar o orçamento hoje"], natureza: "Comercial", proxima_acao: "Enviar orçamento",
      ignorado: false, created_at: "2026-10-02T10:00:00Z", ultima_analise_em: "2026-10-04T10:00:00Z",
    },
    {
      owner_id: ANA, nome: "Cliente B", etapa: null,
      alertas: ["Orçamento não enviado"], dicas: ["Enviar o orçamento hoje"],
      natureza: "Comercial", proxima_acao: "", ignorado: false,
      created_at: "2026-10-03T10:00:00Z", ultima_analise_em: "2026-10-05T10:00:00Z",
    },
    {
      owner_id: ANA, nome: "Colega", etapa: null, alertas: [], dicas: [],
      natureza: "Interno", proxima_acao: "nada", ignorado: true,
      created_at: "2026-10-03T10:00:00Z", ultima_analise_em: "2026-10-05T11:00:00Z",
    },
    // Analisada fora da semana: não entra em "ativas".
    {
      owner_id: BRUNO, nome: "Antigo", etapa: null, alertas: ["x"], dicas: [],
      natureza: "Comercial", proxima_acao: "y", ignorado: false,
      created_at: "2026-01-01T10:00:00Z", ultima_analise_em: "2026-09-01T10:00:00Z",
    },
  ],
  compromissos_mensais: [
    {
      vendedor_id: ANA, meta_faturamento: 50000, meta_clientes_novos: 4, meta_arquitetos: 2,
      meta_construtoras: 1, meta_obras: 1, meta_visitas: 8, meta_ligacoes: 10,
    },
  ],
  etapas_funil: [
    { nome: "Proposta", ordem: 1, tipo: "aberta", conta_no_pipeline: true, probabilidade: "Média", cor: "#111111", ativa: true, chave: "proposta" },
    { nome: "Negociação", ordem: 2, tipo: "aberta", conta_no_pipeline: true, probabilidade: "Alta", cor: "#111111", ativa: true, chave: "negociacao" },
    { nome: "Fechamento", ordem: 3, tipo: "ganho", conta_no_pipeline: false, probabilidade: "Alta", cor: "#111111", ativa: true, chave: "ganho" },
    { nome: "Perdidos", ordem: 4, tipo: "perda", conta_no_pipeline: false, probabilidade: "Baixa", cor: "#111111", ativa: true, chave: "perda" },
  ],
};

/** Dublê do cliente: aceita a cadeia de filtros e devolve a tabela inteira. */
function clienteFalso() {
  const consulta = (tabela: string) => {
    const resultado = { data: TABELAS[tabela] ?? [], error: null };
    const alvo: Record<string, unknown> = {
      then: (r: (v: typeof resultado) => unknown) => Promise.resolve(resultado).then(r),
    };
    for (const m of ["select", "eq", "gte", "lte", "lt", "gt", "in", "not", "order", "limit"]) {
      alvo[m] = () => alvo;
    }
    return alvo;
  };
  return { from: (t: string) => consulta(t) } as never;
}

async function main() {
const loja = await coletarSemanaDaLoja(clienteFalso(), "Loja Teste", SEMANA.inicio, SEMANA.fim);

// ------------------------------------------------------ quem entra
conferir(
  "entram os dois vendedores e o gestor com atividade, na ordem de valor vendido",
  loja.vendedores.map((v) => v.nome),
  ["Ana", "Bruno", "Chefe"],
);

const ana = loja.vendedores.find((v) => v.nome === "Ana")!;
const bruno = loja.vendedores.find((v) => v.nome === "Bruno")!;

// ------------------------------------------------------ bordas de data
conferir("atividades da Ana só dentro da janela", ana.crm.atividades, 4);
conferir("visita de 30/09 e de 08/10 ficam de fora", ana.crm.visitas, 2);
conferir("ligações da Ana", ana.crm.ligacoes, 1);
conferir("orçamentos da Ana", ana.crm.orcamentos, 1);
conferir("visita do Bruno ocorrida na quinta conta", bruno.crm.visitas, 1);

// ------------------------------------------------------ prospecção
conferir("clientes novos da Ana no período", ana.prospeccao.clientesNovos, 1);
conferir(
  "categorias da Ana vêm do cliente ligado e do que ele digitou",
  ana.prospeccao.porCategoria.map((c) => `${c.categoria}:${c.atividades}`).sort(),
  ["Arquiteto:2", "Cliente Final:1", "Obra:1"],
);
conferir(
  "Designer de Interiores aparece para o Bruno",
  bruno.prospeccao.porCategoria.map((c) => c.categoria),
  ["Designer de Interiores"],
);

// ------------------------------------------------------ pipeline
conferir("negócios criados pela Ana no período", ana.pipeline.criados, 2);
conferir("ganho é pelo tipo do funil, não pelo nome", ana.pipeline.ganhos, 1);
conferir("perdido conta pela data da perda", ana.pipeline.perdidos, 1);
conferir("em aberto exclui ganho e perda", ana.pipeline.emAberto, 1);
conferir("valor em aberto da Ana", ana.pipeline.valorEmAberto, 10000);

// ------------------------------------------------------ venda em dupla
conferir("Ana fica com 70% da venda dividida", ana.vendas.valor, 7000);
conferir("Bruno recebe os 30% dela mesmo sem ser o dono", bruno.vendas.valor, 3000);
conferir("venda de setembro não entra", ana.vendas.quantidade, 1);

// ------------------------------------------------------ atendimento
conferir("conversas ativas da Ana", ana.atendimento.conversasAtivas, 3);
conferir("conversas novas da Ana", ana.atendimento.conversasNovas, 3);
conferir("conversas com alerta", ana.atendimento.conversasComAlerta, 2);
conferir("conversa sem próxima ação", ana.atendimento.conversasSemProximaAcao, 1);
conferir("conversa marcada como interna", ana.atendimento.conversasIgnoradas, 1);
conferir(
  "alerta repetido em duas conversas vem primeiro, com a contagem",
  ana.atendimento.alertas[0],
  { texto: "Orçamento não enviado", conversas: 2 },
);
conferir(
  "dica repetida agregada",
  ana.atendimento.dicas[0],
  { texto: "Enviar o orçamento hoje", conversas: 2 },
);
conferir("exemplo traz cliente com nome para a IA citar", ana.atendimento.exemplos.length, 2);
conferir("conversa analisada em setembro não conta para o Bruno", bruno.atendimento.conversasAtivas, 0);

// ------------------------------------------------------ metas e lacunas
conferir("meta aprovada da Ana é lida", ana.metas?.visitas, 8);
conferir("Bruno sem meta aprovada", bruno.metas, null);
conferir(
  "a lacuna das mensagens é declarada",
  loja.lacunas.some((l) => l.includes("não de mensagens")),
  true,
);
conferir(
  "quem está sem meta é nomeado na lacuna",
  loja.lacunas.some((l) => l.includes("Bruno") && l.includes("Chefe")),
  true,
);

// ------------------------------------------------------ totais da loja
conferir("total de visitas da loja", loja.totais.visitas, 3);
conferir("valor vendido da loja soma as duas fatias", loja.totais.valorVendido, 10000);
conferir("negócios ganhos da loja", loja.totais.negociosGanhos, 1);

if (falhas.length) {
  console.error(`\n${falhas.length} FALHA(S):\n`);
  for (const f of falhas) console.error(" - " + f + "\n");
  process.exit(1);
}
console.log(`${ok}/${ok} verificações passaram`);
}

main();
