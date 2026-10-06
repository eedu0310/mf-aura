import {
  colunaDoNegocio, contaNoPipeline, ehFechada, ehGanho, ehPerda,
  etapasVisiveis, FUNIL_PADRAO, nomeDaChave, ordemDe, primeiraEtapa, probabilidadeDe,
} from "./funil";

let falhas = 0;
function ok(desc: string, real: unknown, esperado: unknown) {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? "ok  " : "FALHA"} ${desc} -> ${JSON.stringify(real)}${bom ? "" : ` (esperado ${JSON.stringify(esperado)})`}`);
}

const f = FUNIL_PADRAO;

console.log("--- negocios gravados com o nome ANTIGO acham a coluna nova ---");
ok("Proposta cai em Follow-up", colunaDoNegocio("Proposta", f), "Follow-up");
ok("Fechados cai em Fechamento", colunaDoNegocio("Fechados", f), "Fechamento");
ok("Perdidos continua Perdidos", colunaDoNegocio("Perdidos", f), "Perdidos");
ok("Prospecção continua", colunaDoNegocio("Prospecção", f), "Prospecção");
ok("Negociação continua", colunaDoNegocio("Negociação", f), "Negociação");
ok("Apresentação continua", colunaDoNegocio("Apresentação", f), "Apresentação");

console.log("\n--- o papel da etapa, com nome antigo e com nome novo ---");
ok("Fechados é ganho", ehGanho("Fechados", f), true);
ok("Fechamento é ganho", ehGanho("Fechamento", f), true);
ok("Follow-up NÃO é ganho", ehGanho("Follow-up", f), false);
ok("Perdidos é perda", ehPerda("Perdidos", f), true);
ok("Proposta não é perda", ehPerda("Proposta", f), false);
ok("Fechados é decidido", ehFechada("Fechados", f), true);
ok("Negociação não é decidido", ehFechada("Negociação", f), false);

console.log("\n--- dinheiro no pipeline ---");
ok("Proposta (antigo) conta", contaNoPipeline("Proposta", f), true);
ok("Follow-up conta", contaNoPipeline("Follow-up", f), true);
ok("Negociação conta", contaNoPipeline("Negociação", f), true);
ok("Prospecção NÃO conta", contaNoPipeline("Prospecção", f), false);
ok("Qualificação NÃO conta", contaNoPipeline("Qualificação e Abordagem", f), false);
ok("Fechamento não conta como aberto", contaNoPipeline("Fechamento", f), false);

console.log("\n--- avanço: só vai para frente ---");
ok("Negociação > Follow-up", ordemDe("Negociação", f) > ordemDe("Follow-up", f), true);
ok("Follow-up > Proposta(= o mesmo)", ordemDe("Follow-up", f) === ordemDe("Proposta", f), true);
ok("Perdidos fica em -1", ordemDe("Perdidos", f), -1);
ok("Fechamento é o topo das abertas", ordemDe("Fechamento", f) > ordemDe("Negociação", f), true);

console.log("\n--- papéis ---");
ok("etapa de perda", nomeDaChave("perda", f), "Perdidos");
ok("etapa de ganho", nomeDaChave("fechamento", f), "Fechamento");
ok("negócio novo nasce em", primeiraEtapa(f), "Prospecção");
ok("probabilidade de Proposta (antigo)", probabilidadeDe("Proposta", f), "Média");
ok("colunas visíveis", etapasVisiveis(f).length, 8);

console.log("\n--- funil CUSTOMIZADO pelo gestor: nomes totalmente diferentes ---");
const custom = [
  { nome: "Contato", ordem: 1, tipo: "aberta" as const, contaNoPipeline: false, probabilidade: "Baixa" as const, cor: "#111111", ativa: true, chave: "prospeccao" as const },
  { nome: "Orçamento na mesa", ordem: 2, tipo: "aberta" as const, contaNoPipeline: true, probabilidade: "Alta" as const, cor: "#222222", ativa: true, chave: "followup" as const },
  { nome: "Vendido!", ordem: 3, tipo: "ganho" as const, contaNoPipeline: true, probabilidade: "Alta" as const, cor: "#333333", ativa: true, chave: "fechamento" as const },
  { nome: "Não rolou", ordem: 4, tipo: "perda" as const, contaNoPipeline: false, probabilidade: "Baixa" as const, cor: "#444444", ativa: true, chave: "perda" as const },
];
ok("negócio antigo em Proposta vai para 'Orçamento na mesa'", colunaDoNegocio("Proposta", custom), "Orçamento na mesa");
ok("negócio antigo em Fechados vira 'Vendido!'", colunaDoNegocio("Fechados", custom), "Vendido!");
ok("'Vendido!' registra a venda", ehGanho("Vendido!", custom), true);
ok("'Fechados' ainda é reconhecido como ganho", ehGanho("Fechados", custom), true);
ok("'Não rolou' é perda", ehPerda("Não rolou", custom), true);
ok("etapa que o gestor apagou (Negociação) não some: vira ela mesma", colunaDoNegocio("Negociação", custom), "Negociação");

console.log("\n--- etapa inventada pelo gestor, sem papel ---");
const comNova = [...FUNIL_PADRAO, { nome: "Visita técnica", ordem: 9, tipo: "aberta" as const, contaNoPipeline: false, probabilidade: "Média" as const, cor: "#555555", ativa: true, chave: null }];
ok("aparece no quadro", colunaDoNegocio("Visita técnica", comNova), "Visita técnica");
ok("não é ganho nem perda", ehFechada("Visita técnica", comNova), false);

console.log(falhas === 0 ? "\nTUDO PASSOU" : `\n${falhas} FALHA(S)`);
process.exit(falhas ? 1 : 0);
