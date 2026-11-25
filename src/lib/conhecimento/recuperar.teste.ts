/**
 * O ranking que decide o que da base de conhecimento entra no prompt.
 *
 * Rodar com:
 *   node --experimental-strip-types --no-warnings --import <reg.mjs> src/lib/conhecimento/recuperar.teste.ts
 */
import { estimarTokens, normalizar, palavras, pontuar, ranquear, textoDeUmAprendizado, type ItemConhecimento } from "./recuperar";

let passou = 0;
const falhas: string[] = [];
function conferir(oque: string, real: unknown, esperado: unknown) {
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a === b) passou += 1;
  else falhas.push(`${oque}\n  esperado: ${b}\n  veio:     ${a}`);
}

const agora = new Date("2026-11-25T12:00:00-03:00");
const diasAtras = (n: number) => new Date(agora.getTime() - n * 86_400_000).toISOString();

function item(id: string, busca: string, extra: Partial<ItemConhecimento> = {}): ItemConhecimento {
  return { tipo: "aprendizado", id, texto: `- ${busca}`, busca, criadoEm: diasAtras(30), ...extra };
}

// ---- normalização
conferir("tira acento e pontuação", normalizar("Instalação: é CARA?"), "instalacao e cara");
conferir(
  "palavras sem vazias, com radical",
  palavras("Quanto custa a instalação das lareiras? Os preços são altos"),
  ["quanto", "custa", "instalacao", "lareira", "preco", "alto"],
);
conferir("só palavras vazias", palavras("é de para o que"), []);
conferir("estimativa de tokens", estimarTokens("abcdefgh"), 2);

// ---- relevância manda
{
  const itens = [
    item("a", "cliente acha a lareira cara demais", { vezesFechou: 1 }),
    item("b", "cliente pergunta sobre garantia da chaminé", { vezesFechou: 9 }),
    item("c", "cliente quer saber o prazo de instalação", { vezesFechou: 2 }),
  ];
  const ids = ranquear(itens, "Quanto tempo leva a instalação?", 1000, agora).map((i) => i.id);
  conferir("com consulta, só o que tem palavra em comum", ids, ["c"]);
  const semConsulta = ranquear(itens, "", 1000, agora).map((i) => i.id);
  conferir("sem consulta, o que mais fechou primeiro", semConsulta, ["b", "c", "a"]);
}

// ---- recência desempata
{
  const novo = item("novo", "objeção de preço", { criadoEm: diasAtras(2) });
  const velho = item("velho", "objeção de preço", { criadoEm: diasAtras(700) });
  conferir("mais novo pontua mais", pontuar(novo, new Set(), agora) > pontuar(velho, new Set(), agora), true);
  conferir("ordem por recência", ranquear([velho, novo], "", 1000, agora).map((i) => i.id), ["novo", "velho"]);
}

// ---- perdeu pesa contra
{
  const ganha = item("ganha", "abordagem pela planta", { vezesFechou: 3 });
  const perde = item("perde", "abordagem pela planta", { vezesFechou: 3, vezesPerdeu: 6 });
  conferir("quem perdeu muito fica atrás", ranquear([perde, ganha], "planta", 1000, agora).map((i) => i.id), ["ganha", "perde"]);
}

// ---- orçamento: item inteiro ou nada, e o menor ainda cabe
{
  const grande = item("grande", `lareira ${"x".repeat(400)}`, { vezesFechou: 5 });
  grande.texto = "y".repeat(400); // ~100 tokens
  const pequeno = item("pequeno", "lareira pequena", { vezesFechou: 1 });
  const ids = ranquear([grande, pequeno], "lareira", 50, agora).map((i) => i.id);
  conferir("o grande não cabe, o pequeno entra", ids, ["pequeno"]);
  conferir("orçamento zero não devolve nada", ranquear([pequeno], "", 0, agora), []);
}

// ---- trecho com nota do banco entra mesmo sem palavra igual
{
  const trecho: ItemConhecimento = { tipo: "trecho", id: "t1", texto: "### Garantia\nCinco anos.", busca: "Garantia Cinco anos", notaBanco: 0.4 };
  conferir("nota do banco conta", ranquear([trecho], "quanto tempo de cobertura?", 1000, agora).map((i) => i.id), ["t1"]);
}

// ---- determinismo (cache de prompt)
{
  const a = item("a", "x lareira");
  const b = item("b", "x lareira");
  conferir("empate desempata pelo id", ranquear([b, a], "lareira", 1000, agora).map((i) => i.id), ["a", "b"]);
}

// ---- formato do texto do aprendizado (o mesmo de antes)
conferir(
  "texto do aprendizado",
  textoDeUmAprendizado({ tipo: "objecao", gatilho: "Está caro", resposta: "Mostre o rendimento", vezes_visto: 4, vezes_fechou: 2, vezes_perdeu: 0 }),
  '- Objeção: "Está caro" (visto 4x, fechou 2x)\n  Resposta que funcionou: Mostre o rendimento',
);

if (falhas.length) {
  console.error(`${falhas.length} verificação(ões) falharam:\n\n${falhas.join("\n\n")}`);
  process.exit(1);
}
console.log(`${passou}/${passou} verificações passaram`);
