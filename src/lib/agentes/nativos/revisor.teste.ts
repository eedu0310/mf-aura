/**
 * Testes das regras do Revisor do Aprendizado (sem banco e sem IA): lotes,
 * leitura desconfiada do JSON da IA e as travas que decidem "manter".
 */
import {
  afirmacoesSemApoio, decisaoFinal, decisaoPorRegra, duplicadoDe, emLotes, evidenciaContra, validarPareceres,
  type ItemRevisao, type Parecer,
} from "./revisor-regras";

let falhas = 0;
function ok(desc: string, real: unknown, esperado: unknown) {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? "ok  " : "FALHA"} ${desc} -> ${JSON.stringify(real)}${bom ? "" : ` (esperado ${JSON.stringify(esperado)})`}`);
}

const item = (p: Partial<ItemRevisao> = {}): ItemRevisao => ({
  id: "a1", empresa: "LF Lareiras", tipo: "objecao", gatilho: "acho a lareira cara",
  resposta: "Mostre quanto o cliente economiza de lenha com o alto rendimento.", vezes_visto: 3, vezes_fechou: 1, vezes_perdeu: 0, ...p,
});
const parecer = (p: Partial<Parecer> = {}): Parecer => ({ id: "a1", decisao: "aprovar", motivo: "Útil e correto.", confianca: 0.9, ...p });

console.log("--- lotes ---");
ok("25 itens em lotes de 10", emLotes(Array.from({ length: 25 }, (_, i) => i)).map((l) => l.length), [10, 10, 5]);
ok("lista vazia, nenhum lote", emLotes([]).length, 0);
ok("tamanho inválido vira 1", emLotes([1, 2], 0).length, 2);

console.log("\n--- JSON da IA ---");
const ids = ["a1", "a2", "a3"];
const v = validarPareceres(
  {
    decisoes: [
      { id: "a1", decisao: "aprovar", motivo: "Boa resposta. Segunda frase some.", confianca: 0.9, resposta_ajustada: "Texto ajustado ok" },
      { id: "a2", decisao: "talvez", motivo: "x", confianca: 0.9 },
      { id: "zz", decisao: "aprovar", motivo: "id de fora", confianca: 0.9 },
      { id: "a3", decisao: "recusar", motivo: "", confianca: 0.9 },
      { id: "a1", decisao: "recusar", motivo: "repetido", confianca: 0.9 },
    ],
  },
  ids,
);
ok("só o válido entra", [...v.keys()], ["a1"]);
ok("motivo vira uma frase", v.get("a1")?.motivo, "Boa resposta.");
ok("guarda a resposta ajustada", v.get("a1")?.resposta_ajustada, "Texto ajustado ok");
ok("primeiro parecer do id vale", v.get("a1")?.decisao, "aprovar");
ok("aceita a lista direta", validarPareceres([{ id: "a2", decisao: "manter", motivo: "Dúvida.", confianca: "0.5" }], ids).get("a2")?.confianca, 0.5);
ok("confiança fora de 0–1 é descartada", validarPareceres([{ id: "a2", decisao: "aprovar", motivo: "x.", confianca: 7 }], ids).size, 0);
ok("lixo não quebra", validarPareceres("texto solto", ids).size, 0);

console.log("\n--- regras antes da IA ---");
ok("evidência contra: perdeu 3, fechou 0", evidenciaContra({ vezes_fechou: 0, vezes_perdeu: 3 }), true);
ok("perdeu 2, fechou 0: poucos casos", evidenciaContra({ vezes_fechou: 0, vezes_perdeu: 2 }), false);
ok("perdeu 2, fechou 2: não contradiz", evidenciaContra({ vezes_fechou: 2, vezes_perdeu: 2 }), false);
ok("contradição fica para o gestor sem gastar IA", decisaoPorRegra(item({ vezes_fechou: 1, vezes_perdeu: 3 }), [])?.decisao, "manter");
ok("telefone no texto é recusado", decisaoPorRegra(item({ resposta: "Ligue para (51) 99876-5432" }), [])?.decisao, "recusar");
const aprovados = [{ id: "ap1", empresa: "LF Lareiras", gatilho: "Acho a lareira cara!" }];
ok("repete aprovado da loja", duplicadoDe(item(), aprovados), "ap1");
ok("mesmo texto em outra loja não é repetido", duplicadoDe(item({ empresa: "Sole Aquecimento" }), aprovados), null);
ok("repetido é recusado por regra", decisaoPorRegra(item(), aprovados)?.decisao, "recusar");
ok("item limpo vai para a IA", decisaoPorRegra(item({ gatilho: "demora para instalar?" }), aprovados), null);

console.log("\n--- travas depois da IA ---");
ok("sem parecer → manter", decisaoFinal(item(), undefined, "").decisao, "manter");
ok("confiança 0,7 → manter", decisaoFinal(item(), parecer({ confianca: 0.7 }), "").decisao, "manter");
ok("confiança 0,75 aprova", decisaoFinal(item(), parecer({ confianca: 0.75 }), "").decisao, "aprovar");
ok("IA aprova mas a evidência contradiz → manter", decisaoFinal(item({ vezes_fechou: 0, vezes_perdeu: 4 }), parecer(), "").decisao, "manter");
ok("recusa confiante vale", decisaoFinal(item(), parecer({ decisao: "recusar" }), "").decisao, "recusar");
const comPreco = item({ resposta: "Sai por R$ 12.900 em 10x sem juros." });
ok("preço sem apoio nos materiais → manter", decisaoFinal(comPreco, parecer(), "Manual: lareira Adatto, alto rendimento.").decisao, "manter");
ok("o que falta é dito", afirmacoesSemApoio(comPreco.resposta, "nada"), ["12.900", "10", "preço", "pagamento"]);
ok(
  "preço que está no material aprova",
  decisaoFinal(comPreco, parecer(), "Tabela: Adatto R$ 12.900 em até 10x sem juros no cartão.").decisao,
  "aprovar",
);
ok("aprova com a resposta ajustada", decisaoFinal(item(), parecer({ resposta_ajustada: "Mostre a economia de lenha." }), "").novaResposta, "Mostre a economia de lenha.");
ok("ajuste com e-mail é recusado", decisaoFinal(item(), parecer({ resposta_ajustada: "Mande para loja@x.com.br" }), "").decisao, "recusar");
ok("pergunta do cliente pode falar de prazo", decisaoFinal(item({ gatilho: "qual o prazo de entrega?", resposta: "Confirme a data com o técnico antes de prometer." }), parecer(), "").decisao, "aprovar");

console.log(falhas === 0 ? "\nTUDO PASSOU" : `\n${falhas} FALHA(S)`);
process.exit(falhas ? 1 : 0);
