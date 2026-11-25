/**
 * Teste dos números compartilhados entre as telas (src/lib/kpis.ts).
 *
 * O que protege: que "pipeline aberto", "vendido", "negócios em aberto",
 * conversão e nota média tenham UMA conta. Se alguém voltar a somar todos os
 * negócios no pipeline, ou a dar a venda em dupla inteira para os dois, um
 * destes testes quebra.
 */
import { FUNIL_PADRAO } from "./funil";
import {
  ehAtividadeDoVendedor,
  negocioEmAberto,
  notaMedia,
  pipelineAberto,
  quantidadeDeVendas,
  taxaConversao,
  ticketMedio,
  totalVendido,
  vendasDoMes,
} from "./kpis";

let falhas = 0;
let total = 0;
function igual(a: unknown, b: unknown, o_que: string) {
  total++;
  if (a !== b) {
    falhas++;
    console.error(`  FALHOU: ${o_que} (deu ${JSON.stringify(a)}, esperava ${JSON.stringify(b)})`);
  }
}

const F = FUNIL_PADRAO;

// ------------------------------------------------------- negócio em aberto
igual(negocioEmAberto("Prospecção", F), true, "prospecção está em aberto");
igual(negocioEmAberto("Negociação", F), true, "negociação está em aberto");
igual(negocioEmAberto("Proposta", F), true, "nome antigo 'Proposta' continua em aberto");
igual(negocioEmAberto("Fechamento", F), false, "ganho não está em aberto");
igual(negocioEmAberto("Fechados", F), false, "nome antigo do ganho não está em aberto");
igual(negocioEmAberto("Perdidos", F), false, "perda não está em aberto");
igual(negocioEmAberto("Pós-venda", F), false, "pós-venda não está em aberto");
igual(negocioEmAberto("Leads frios", F), false, "lead frio não está em aberto");
igual(negocioEmAberto("Etapa inventada", F), false, "etapa desconhecida não conta");
igual(negocioEmAberto(null, F), false, "sem etapa não conta");

// --------------------------------------------------------- pipeline aberto
const negocios = [
  { etapa: "Prospecção", valor: 100_000 }, // não conta no pipeline
  { etapa: "Follow-up", valor: 3000 },
  { etapa: "Negociação", valor: "7000" }, // texto do banco
  { etapa: "Fechamento", valor: 50_000 }, // ganho: conta_no_pipeline=true, mas não é aberto
  { etapa: "Perdidos", valor: 9000 },
  { etapa: "Pós-venda", valor: 4000 },
  { etapa: "Negociação", valor: null },
];
const p = pipelineAberto(negocios, F);
igual(p.valor, 10_000, "pipeline soma só follow-up e negociação");
igual(p.qtd, 3, "pipeline conta os três negócios que formam o valor");
igual(pipelineAberto([], F).valor, 0, "pipeline vazio é zero");

// ------------------------------------------------------------------ vendas
const ANA = "a";
const BIA = "b";
const vendas = [
  { owner_id: ANA, valor: 1000, valor_fechado: 900, data: "2026-11-01" },
  { owner_id: ANA, parceiro_id: BIA, percentual_parceiro: 40, valor: 2000, data: "2026-11-30" },
  { owner_id: BIA, valor: 500, data: "2026-10-31" },
];
const nov = vendasDoMes(vendas, "2026-11");
igual(nov.length, 2, "vendas do mês pelo prefixo da data, dia 1 e dia 30 incluídos");
igual(vendasDoMes(vendas, "2026-12").length, 0, "mês sem venda devolve lista vazia");
igual(totalVendido(nov), 2900, "total da loja usa o valor fechado e a venda cheia");
igual(totalVendido(nov, ANA), 2100, "Ana leva a venda dela e 60% da dupla");
igual(totalVendido(nov, BIA), 800, "Bia leva 40% da dupla");
igual(totalVendido(nov, ANA) + totalVendido(nov, BIA), totalVendido(nov), "fatias somam o total da loja");
igual(quantidadeDeVendas(nov), 2, "quantidade da loja");
igual(quantidadeDeVendas(nov, BIA), 1, "venda em dupla conta para o parceiro");
igual(ticketMedio(2900, 2), 1450, "ticket médio");
igual(ticketMedio(0, 0), 0, "ticket sem venda é zero, não NaN");

// --------------------------------------------------------------- conversão
igual(taxaConversao(3, 1), 75, "conversão sobre o decidido");
igual(taxaConversao(0, 0), null, "sem nada decidido não há conversão");
igual(taxaConversao(0, 4), 0, "só perdas é 0%");

// -------------------------------------------------------------- atividades
igual(ehAtividadeDoVendedor({ tipo: "Visita", titulo: "Visita na obra" }), true, "visita é do vendedor");
igual(ehAtividadeDoVendedor({ tipo: "Outro", titulo: "Etapa alterada: A → B" }), false, "mudança de etapa é do sistema");
igual(ehAtividadeDoVendedor({ tipo: "Outro", titulo: "IA moveu para Negociação" }), false, "movimento da IA é do sistema");
igual(ehAtividadeDoVendedor({ tipo: "Outro", titulo: "Ligação extra" }), true, "'Outro' lançado à mão conta");

// -------------------------------------------------------------- nota média
igual(notaMedia([5, 4, null, 0, undefined]), 4.5, "média só de quem deu nota");
igual(notaMedia([]), null, "sem nota não há média");
igual(notaMedia(["3", 5]), 4, "nota em texto do banco");

console.log(`${total - falhas}/${total} verificações passaram`);
if (falhas) process.exit(1);
