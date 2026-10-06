/**
 * Teste da divisão de venda em dupla. Roda com:
 *   npx tsx src/lib/parceria.teste.ts
 *
 * O que estes testes protegem: que a soma do que os vendedores venderam seja
 * igual ao que a loja vendeu. Se um dia alguém "simplificar" a conta dando a
 * venda inteira para os dois, o total da loja passa a ser menor que a soma da
 * equipe e o ranking fica mentindo.
 */
import {
  donoDaVenda,
  fatiaDoParceiro,
  parceiroDaVenda,
  participaDaVenda,
  rotuloDaDivisao,
  somaDoVendedor,
  valorCheio,
  valorDoVendedor,
  vendasDoVendedor,
} from "./parceria";

let falhas = 0;
let total = 0;
function ok(certo: boolean, o_que: string) {
  total++;
  if (!certo) {
    falhas++;
    console.error("  FALHOU:", o_que);
  }
}
function igual(a: unknown, b: unknown, o_que: string) {
  ok(a === b, `${o_que} (deu ${JSON.stringify(a)}, esperava ${JSON.stringify(b)})`);
}

const DENISE = "11111111-1111-1111-1111-111111111111";
const MAJU = "22222222-2222-2222-2222-222222222222";
const ESTRANHO = "33333333-3333-3333-3333-333333333333";

// ---------------------------------------------------- venda normal, sem dupla
const sozinha = { owner_id: DENISE, valor: 1000, valor_fechado: 900 };
igual(donoDaVenda(sozinha), DENISE, "dono da venda sozinha");
igual(parceiroDaVenda(sozinha), null, "venda sozinha não tem parceiro");
igual(valorCheio(sozinha), 900, "valor cheio usa o valor fechado");
igual(fatiaDoParceiro(sozinha), 0, "sem parceiro a fatia é zero");
igual(valorDoVendedor(sozinha, DENISE), 900, "dono leva a venda inteira");
igual(valorDoVendedor(sozinha, MAJU), 0, "quem não participou leva zero");
igual(rotuloDaDivisao(sozinha, DENISE), null, "venda sozinha não tem rótulo");

// ------------------------------------------------- o caso Denise/Maju, 50/50
const dividida = {
  owner_id: DENISE,
  parceiro_id: MAJU,
  percentual_parceiro: 50,
  valor: 10000,
  valor_fechado: 10000,
};
igual(valorDoVendedor(dividida, DENISE), 5000, "metade para quem atendeu");
igual(valorDoVendedor(dividida, MAJU), 5000, "metade para quem entrou junto");
igual(valorDoVendedor(dividida, ESTRANHO), 0, "terceiro não leva nada");
igual(
  valorDoVendedor(dividida, DENISE) + valorDoVendedor(dividida, MAJU),
  valorCheio(dividida),
  "as duas fatias somam a venda inteira",
);
ok(participaDaVenda(dividida, MAJU), "parceiro participa da venda");
ok(!participaDaVenda(dividida, ESTRANHO), "terceiro não participa");

// -------------------------------------------- divisão desigual (70 do dono)
const desigual = { ...dividida, percentual_parceiro: 30 };
igual(valorDoVendedor(desigual, DENISE), 7000, "dono fica com 70%");
igual(valorDoVendedor(desigual, MAJU), 3000, "parceiro fica com 30%");
igual(
  valorDoVendedor(desigual, DENISE) + valorDoVendedor(desigual, MAJU),
  10000,
  "divisão desigual também soma a venda inteira",
);

// --------------------------------- parceiro marcado mas com 0% é venda cheia
const parceiroSemFatia = { ...dividida, percentual_parceiro: 0 };
igual(valorDoVendedor(parceiroSemFatia, DENISE), 10000, "0% deixa tudo com o dono");
igual(valorDoVendedor(parceiroSemFatia, MAJU), 0, "parceiro com 0% não leva valor");
ok(
  participaDaVenda(parceiroSemFatia, MAJU),
  "parceiro com 0% ainda vê a venda (entrou no atendimento)",
);

// ----------------------------------------------------------- dados estragados
igual(
  valorDoVendedor({ owner_id: DENISE, parceiro_id: DENISE, percentual_parceiro: 50, valor: 800 }, DENISE),
  800,
  "parceiro igual ao dono não divide a venda com ele mesmo",
);
igual(
  valorDoVendedor({ owner_id: DENISE, parceiro_id: MAJU, percentual_parceiro: 150, valor: 100 }, MAJU),
  100,
  "percentual acima de 100 é aparado em 100",
);
igual(
  valorDoVendedor({ owner_id: DENISE, parceiro_id: MAJU, percentual_parceiro: 150, valor: 100 }, DENISE),
  0,
  "com o percentual aparado o dono nunca fica negativo",
);
igual(
  valorDoVendedor({ owner_id: DENISE, parceiro_id: MAJU, percentual_parceiro: -40, valor: 100 }, DENISE),
  100,
  "percentual negativo é aparado em zero",
);
igual(
  valorDoVendedor({ owner_id: DENISE, parceiro_id: MAJU, percentual_parceiro: null, valor: 500 }, DENISE),
  500,
  "percentual nulo é tratado como zero",
);
igual(valorDoVendedor(sozinha, null), 0, "sem vendedor informado não há fatia");
igual(valorDoVendedor(sozinha, "  "), 0, "id em branco não é vendedor");
igual(
  valorDoVendedor({ owner_id: DENISE, valor: Number.NaN }, DENISE),
  0,
  "valor inválido vira zero em vez de NaN",
);

// ------------------------------------------- a venda em camelCase (das telas)
const daTela = {
  ownerId: DENISE,
  parceiroId: MAJU,
  percentualParceiro: 40,
  valorFechado: 2000,
  valor: 2000,
};
igual(valorDoVendedor(daTela, MAJU), 800, "camelCase: parceiro leva 40%");
igual(valorDoVendedor(daTela, DENISE), 1200, "camelCase: dono leva 60%");
igual(
  donoDaVenda({ vendedorId: DENISE }),
  DENISE,
  "camelCase: vendedorId serve de dono quando não há ownerId",
);

// ------------------------------------------------------------- somas e listas
const lista = [sozinha, dividida, desigual, { owner_id: ESTRANHO, valor: 100 }];
igual(somaDoVendedor(lista, DENISE), 900 + 5000 + 7000, "soma do dono nas três vendas");
igual(somaDoVendedor(lista, MAJU), 5000 + 3000, "soma do parceiro nas duas divididas");
igual(vendasDoVendedor(lista, MAJU).length, 2, "a Maju vê as duas vendas em dupla");
igual(vendasDoVendedor(lista, DENISE).length, 3, "a Denise vê as três dela");
igual(
  somaDoVendedor(lista, DENISE) + somaDoVendedor(lista, MAJU) + somaDoVendedor(lista, ESTRANHO),
  lista.reduce((s, v) => s + valorCheio(v), 0),
  "a soma da equipe é igual ao total das vendas",
);

// ------------------------------------------------------------------- rótulos
igual(rotuloDaDivisao(dividida, DENISE), "50% seu", "rótulo visto pelo dono");
igual(rotuloDaDivisao(desigual, MAJU), "30% seu", "rótulo visto pelo parceiro");
igual(
  rotuloDaDivisao(desigual, ESTRANHO),
  "dividida 70% / 30%",
  "o gestor vê a divisão dos dois lados",
);

console.log(`${total - falhas}/${total} verificações passaram`);
if (falhas) process.exit(1);
