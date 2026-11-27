/**
 * Regras do rastreio de avaliação pela conversa (27/11/2026).
 *
 * Rodar com:
 *   node --experimental-strip-types --no-warnings --import <reg.mjs> src/lib/avaliacao/rastreio.teste.ts
 */
import { clienteDizQueAvaliou, fimDoTelefone, linkDeAvaliacao } from "./rastreio";

let passou = 0;
const falhas: string[] = [];
function conferir(oque: string, real: unknown, esperado: unknown) {
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a === b) passou += 1;
  else falhas.push(`${oque}\n  esperado: ${b}\n  veio:     ${a}`);
}

const LOJAS = [
  { empresa: "LF Lareiras", link: "https://g.page/r/CQxyzLF/review" },
  { empresa: "A&G Aquecimento", link: "https://maps.app.goo.gl/AbC123agx" },
];

// ---- link do vendedor
conferir(
  "link curto da AURA",
  linkDeAvaliacao("Oi Ana! Avalia a gente: https://crm.mflaser.com.br/av/3f2a1b4c-1111-4222-8333-123456789abc obrigado"),
  { token: "3f2a1b4c-1111-4222-8333-123456789abc", empresa: null },
);
conferir("link cadastrado da loja", linkDeAvaliacao("segue https://maps.app.goo.gl/AbC123agx", LOJAS), {
  token: null,
  empresa: "A&G Aquecimento",
});
conferir("writereview do Google", linkDeAvaliacao("https://search.google.com/local/writereview?placeid=xyz"), {
  token: null,
  empresa: null,
});
conferir("g.page/r", linkDeAvaliacao("Se puder: g.page/r/QWERTY/review"), { token: null, empresa: null });
conferir("maps com fala de avaliação", linkDeAvaliacao("deixa tuas estrelas aqui https://maps.app.goo.gl/zzz999"), {
  token: null,
  empresa: null,
});
conferir("maps só com o endereço NÃO é avaliação", linkDeAvaliacao("nosso endereço: https://maps.app.goo.gl/zzz999"), null);
conferir("catálogo NÃO é avaliação", linkDeAvaliacao("catálogo: https://mflaser.com.br/catalogo.pdf"), null);
conferir("texto sem link", linkDeAvaliacao("pode avaliar a gente?"), null);

// ---- cliente diz que avaliou
for (const t of [
  "Avaliei!",
  "já avaliei lá 😊",
  "Pronto, deixei a avaliação",
  "dei 5 estrelas pra vcs",
  "Fiz a avaliação agora",
  "coloquei 5 estrelas",
  "avaliação feita!",
  "Já foi avaliado",
  "avaliei o atendimento no google, nota 10",
]) {
  conferir(`avaliou: "${t}"`, clienteDizQueAvaliou(t), true);
}
for (const t of [
  "ainda não avaliei",
  "não consegui avaliar, o link não abre",
  "vou avaliar mais tarde",
  "avaliei o orçamento e achei caro",
  "avaliei as opções com meu marido",
  "nem deixei comentário ainda",
  "o que é avaliação?",
  "",
]) {
  conferir(`não avaliou: "${t}"`, clienteDizQueAvaliou(t), false);
}

// ---- telefone
conferir("fim do telefone com 9", fimDoTelefone("+55 (51) 99506-8865"), "95068865");
conferir("fim do telefone sem 9", fimDoTelefone("5195068865"), "95068865");
conferir("telefone curto", fimDoTelefone("8865"), null);

if (falhas.length) {
  console.error(`${falhas.length} verificação(ões) falharam:\n\n${falhas.join("\n\n")}`);
  process.exit(1);
}
console.log(`${passou}/${passou} verificações passaram`);
