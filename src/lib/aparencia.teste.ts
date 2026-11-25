/**
 * Teste da aparência (src/lib/aparencia.ts): datas comemorativas e leitura
 * segura do que vem do banco.
 * Rodar: npx tsx src/lib/aparencia.teste.ts
 */
import { dentroDaJanela, hojeMMDD, normalizarAparencia, paletaDoDia, type ConfigAparencia } from "./aparencia";

let falhas = 0;
let total = 0;
function igual(a: unknown, b: unknown, o_que: string) {
  total++;
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    falhas++;
    console.error(`  FALHOU: ${o_que} (deu ${JSON.stringify(a)}, esperava ${JSON.stringify(b)})`);
  }
}

console.log("Aparência:");
igual(dentroDaJanela("12-10", "12-01", "12-26"), true, "10/12 está no Natal");
igual(dentroDaJanela("12-27", "12-01", "12-26"), false, "27/12 já saiu do Natal");
igual(dentroDaJanela("01-03", "12-20", "01-06"), true, "janela que vira o ano: 03/01");
igual(dentroDaJanela("12-25", "12-20", "01-06"), true, "janela que vira o ano: 25/12");
igual(dentroDaJanela("02-01", "12-20", "01-06"), false, "fora da janela que vira o ano");

const c: ConfigAparencia = {
  paleta: "terracota",
  fundoPipeline: "tijolo",
  agenda: [
    { id: "natal", nome: "Natal", paleta: "natal", inicio: "12-01", fim: "12-26", ativo: true },
    { id: "bf", nome: "Black Friday", paleta: "blackfriday", inicio: "11-20", fim: "11-30", ativo: false },
  ],
};
igual(paletaDoDia(c, "12-15").paleta, "natal", "data ligada troca a paleta");
igual(paletaDoDia(c, "11-25").paleta, "terracota", "data desligada não troca");
igual(paletaDoDia(c, "03-10").paleta, "terracota", "fora das datas vale a escolhida");
igual(paletaDoDia(c, "12-15").data?.nome, "Natal", "diz qual data está valendo");

const lido = normalizarAparencia({
  paleta: "inexistente",
  fundo_pipeline: "<script>",
  agenda: [
    { id: "x", nome: "Ok", paleta: "vinho", inicio: "02-10", fim: "02-14", ativo: true },
    { id: "y", nome: "Data ruim", paleta: "vinho", inicio: "13-40", fim: "02-14", ativo: true },
    { id: "z", nome: "Paleta ruim", paleta: "rosa", inicio: "02-10", fim: "02-14", ativo: true },
  ],
});
igual(lido.paleta, "aura", "paleta desconhecida vira a original");
igual(lido.fundoPipeline, "liso", "fundo desconhecido vira liso");
igual(lido.agenda.map((a) => a.id), ["x"], "só as datas válidas ficam");
igual(normalizarAparencia(null).paleta, "aura", "sem nada, o padrão");
igual(/^\d{2}-\d{2}$/.test(hojeMMDD(new Date("2026-12-31T23:30:00-03:00"))), true, "hoje no formato MM-DD");
igual(hojeMMDD(new Date("2027-01-01T01:00:00Z")), "12-31", "hoje é o dia de São Paulo, não o UTC");

console.log(`  ${total - falhas}/${total} conferências ok`);
if (falhas) process.exit(1);
