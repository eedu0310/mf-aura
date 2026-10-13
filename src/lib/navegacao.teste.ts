/**
 * O menu é montado por cargo, e isso já escondeu tela de gente que precisava.
 *
 * A Agenda ficou só no menu de Vendedor: Vendedor Interno, Pós-venda e SDR
 * não tinham como chegar nela — cinco dos dez vendedores da casa. A tela
 * existia e funcionava; ninguém linkava para ela. Para a vendedora isso
 * apareceu como "a agenda sumiu da AURA".
 *
 * Este teste percorre TODOS os cargos do tipo Cargo, não uma lista escrita de
 * novo aqui. Cargo novo que nascer sem agenda quebra o teste.
 *
 * Rodar com: npx tsx src/lib/navegacao.teste.ts
 */
import { menuDoCargo, menuDeGestao } from "./navegacao";
import type { Cargo } from "./types";

const CARGOS: Cargo[] = [
  "Vendedor",
  "Vendedor Interno",
  "SDR",
  "Pós-venda",
  "Marketing",
  "Gestor",
];

let passou = 0;
const falhas: string[] = [];

function conferir(oque: string, real: unknown, esperado: unknown) {
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a === b) passou += 1;
  else falhas.push(`${oque}\n  esperado: ${b}\n  veio:     ${a}`);
}

for (const cargo of CARGOS) {
  const menu = [...menuDoCargo(cargo), ...menuDeGestao(cargo)];
  const hrefs = menu.map((m) => m.href);

  conferir(`${cargo} tem Agenda no menu`, hrefs.includes("/agenda"), true);
  conferir(`${cargo} tem Meu Dia no menu`, hrefs.includes("/meu-dia"), true);
  conferir(`${cargo} não tem item repetido`, hrefs.length, new Set(hrefs).size);
  conferir(
    `${cargo} não tem item sem rótulo`,
    menu.filter((m) => !m.label || !m.href).length,
    0,
  );
}

// Cargo desconhecido (perfil antigo, cargo digitado errado) não pode ficar sem
// menu nenhum: cai no de vendedor.
const desconhecido = menuDoCargo("Cargo Que Nao Existe").map((m) => m.href);
conferir("cargo desconhecido ainda recebe menu", desconhecido.length > 0, true);
conferir("cargo desconhecido também tem Agenda", desconhecido.includes("/agenda"), true);
conferir("cargo vazio não quebra", menuDoCargo(null).length > 0, true);

// Acentuação e caixa não podem decidir quem vê o quê.
conferir(
  "pos-venda sem acento cai no mesmo menu",
  menuDoCargo("pos-venda").map((m) => m.href),
  menuDoCargo("Pós-venda").map((m) => m.href),
);
conferir(
  "cargo em caixa alta cai no mesmo menu",
  menuDoCargo("VENDEDOR INTERNO").map((m) => m.href),
  menuDoCargo("Vendedor Interno").map((m) => m.href),
);

if (falhas.length) {
  console.error(`${falhas.length} verificação(ões) falharam:\n\n${falhas.join("\n\n")}`);
  process.exit(1);
}
console.log(`${passou}/${passou} verificações passaram`);
