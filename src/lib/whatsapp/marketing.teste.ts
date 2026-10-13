/** npx tsx src/lib/whatsapp/marketing.teste.ts */
import { anuncioDaConversa } from "./marketing";
import type { WaMessage } from "./live-manager";

let passou = 0;
const falhas: string[] = [];
function conferir(oque: string, real: unknown, esperado: unknown) {
  const a = JSON.stringify(real), b = JSON.stringify(esperado);
  if (a === b) passou += 1;
  else falhas.push(`${oque}\n  esperado: ${b}\n  veio:     ${a}`);
}

const anuncio = (id: string) => ({
  titulo: `Anúncio ${id}`, corpo: null, anuncioId: id, url: null,
  plataforma: "facebook" as const, tipo: "ad", cliqueId: `c${id}`,
});
const msg = (t: number, fromMe: boolean, a?: ReturnType<typeof anuncio>) =>
  ({ id: `m${t}`, chatId: "c", fromMe, text: "", timestamp: t, type: "text", hasMedia: false, ...(a ? { anuncio: a } : {}) }) as unknown as WaMessage;

conferir("sem anúncio nenhum", anuncioDaConversa([msg(1, false), msg(2, true)]), null);
conferir("conversa vazia", anuncioDaConversa([]), null);
conferir("acha o anúncio", anuncioDaConversa([msg(1, false, anuncio("A"))])?.anuncioId, "A");

/*
 * O caso que importa: a pessoa voltou meses depois por outro anúncio. O lead
 * continua sendo de quem o trouxe — senão o relatório credita a venda ao
 * anúncio errado, que é pior do que não ter relatório.
 */
conferir(
  "vale o primeiro anúncio, não o último",
  anuncioDaConversa([msg(300, false, anuncio("NOVO")), msg(100, false, anuncio("ORIGINAL"))])?.anuncioId,
  "ORIGINAL",
);
conferir(
  "ordem da lista não importa",
  anuncioDaConversa([msg(100, false, anuncio("ORIGINAL")), msg(300, false, anuncio("NOVO"))])?.anuncioId,
  "ORIGINAL",
);
// Carimbo numa mensagem NOSSA é eco de encaminhamento, não origem do lead.
conferir(
  "ignora carimbo em mensagem do vendedor",
  anuncioDaConversa([msg(50, true, anuncio("ECO")), msg(100, false, anuncio("REAL"))])?.anuncioId,
  "REAL",
);
conferir("só eco do vendedor não vira lead", anuncioDaConversa([msg(50, true, anuncio("ECO"))]), null);

if (falhas.length) {
  console.error(`${falhas.length} falharam:\n\n${falhas.join("\n\n")}`);
  process.exit(1);
}
console.log(`${passou}/${passou} verificações passaram`);
