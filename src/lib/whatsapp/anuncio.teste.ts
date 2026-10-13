/**
 * O lead de anúncio é a base de todo o controle de marketing: se a leitura
 * errar, o relatório inteiro mente. Rodar com:
 *   npx tsx src/lib/whatsapp/anuncio.teste.ts
 */
import { extrairAnuncio, chaveDaCampanha, nomeDaCampanha } from "./anuncio";

let passou = 0;
const falhas: string[] = [];
function conferir(oque: string, real: unknown, esperado: unknown) {
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a === b) passou += 1;
  else falhas.push(`${oque}\n  esperado: ${b}\n  veio:     ${a}`);
}

const anuncioFb = {
  title: "Lareiras a pellet — LF Lareiras",
  body: "Aqueça sua casa com design",
  sourceId: "120210000000123456",
  sourceUrl: "https://fb.me/abcdef",
  sourceType: "ad",
  ctwaClid: "ARbc123clique",
};

// --------------------------------------------- texto puro (o caso mais comum)
conferir(
  "lê anúncio pendurado em mensagem de texto",
  extrairAnuncio({ message: { extendedTextMessage: { text: "Tenho interesse", contextInfo: { externalAdReply: anuncioFb } } } }),
  {
    titulo: "Lareiras a pellet — LF Lareiras",
    corpo: "Aqueça sua casa com design",
    anuncioId: "120210000000123456",
    url: "https://fb.me/abcdef",
    plataforma: "facebook",
    tipo: "ad",
    cliqueId: "ARbc123clique",
  },
);

// ------------------------------------------------- pendurado em outros tipos
conferir(
  "lê anúncio em mensagem com imagem",
  extrairAnuncio({ message: { imageMessage: { caption: "oi", contextInfo: { externalAdReply: anuncioFb } } } })?.anuncioId,
  "120210000000123456",
);
conferir(
  "lê anúncio em mensagem de vídeo",
  extrairAnuncio({ message: { videoMessage: { contextInfo: { externalAdReply: anuncioFb } } } })?.anuncioId,
  "120210000000123456",
);
conferir(
  "lê anúncio dentro de mensagem efêmera",
  extrairAnuncio({ message: { ephemeralMessage: { message: { extendedTextMessage: { contextInfo: { externalAdReply: anuncioFb } } } } } })?.anuncioId,
  "120210000000123456",
);

// ------------------------------------------------------------- plataforma
conferir("instagram pelo link", extrairAnuncio({ message: { extendedTextMessage: { contextInfo: { externalAdReply: { ...anuncioFb, sourceUrl: "https://instagram.com/p/xyz" } } } } })?.plataforma, "instagram");
conferir("instagram pelo ig.me", extrairAnuncio({ message: { extendedTextMessage: { contextInfo: { externalAdReply: { ...anuncioFb, sourceUrl: "https://ig.me/abc" } } } } })?.plataforma, "instagram");
conferir("facebook pelo fb.me", extrairAnuncio({ message: { extendedTextMessage: { contextInfo: { externalAdReply: anuncioFb } } } })?.plataforma, "facebook");
conferir(
  "sem link reconhecível cai em meta, não chuta",
  extrairAnuncio({ message: { extendedTextMessage: { contextInfo: { externalAdReply: { title: "X", sourceId: "9" } } } } })?.plataforma,
  "meta",
);

// ------------------------------------------------------- quando NÃO é anúncio
conferir("mensagem comum não vira lead de anúncio", extrairAnuncio({ message: { conversation: "bom dia" } }), null);
conferir("resposta citada não é anúncio", extrairAnuncio({ message: { extendedTextMessage: { contextInfo: { quotedMessage: { conversation: "x" } } } } }), null);
conferir("mensagem vazia não quebra", extrairAnuncio({}), null);
conferir("nulo não quebra", extrairAnuncio(null), null);
conferir(
  "carimbo vazio é descartado em vez de virar lead sem origem",
  extrairAnuncio({ message: { extendedTextMessage: { contextInfo: { externalAdReply: { showAdAttribution: true } } } } }),
  null,
);

// ------------------------------------------------------------- agrupamento
conferir("agrupa pelo id do anúncio", chaveDaCampanha(extrairAnuncio({ message: { extendedTextMessage: { contextInfo: { externalAdReply: anuncioFb } } } })!), "id:120210000000123456");
// Dois cliques diferentes no MESMO anúncio têm de cair na mesma campanha.
const clique2 = extrairAnuncio({ message: { extendedTextMessage: { contextInfo: { externalAdReply: { ...anuncioFb, ctwaClid: "OUTROCLIQUE" } } } } })!;
conferir("cliques diferentes, mesma campanha", chaveDaCampanha(clique2), "id:120210000000123456");
conferir(
  "sem id, agrupa pela url",
  chaveDaCampanha(extrairAnuncio({ message: { extendedTextMessage: { contextInfo: { externalAdReply: { sourceUrl: "https://fb.me/z", ctwaClid: "c1" } } } } })!),
  "url:https://fb.me/z",
);
conferir(
  "só com clique não agrupa (seria uma campanha por pessoa)",
  chaveDaCampanha(extrairAnuncio({ message: { extendedTextMessage: { contextInfo: { externalAdReply: { ctwaClid: "c1" } } } } })!),
  null,
);
conferir("nome legível da campanha", nomeDaCampanha(extrairAnuncio({ message: { extendedTextMessage: { contextInfo: { externalAdReply: anuncioFb } } } })!), "Facebook · Lareiras a pellet — LF Lareiras");

// -------------------------------------------------------------- robustez
const gigante = "x".repeat(5000);
conferir(
  "título gigante é cortado, não enche o banco",
  extrairAnuncio({ message: { extendedTextMessage: { contextInfo: { externalAdReply: { ...anuncioFb, title: gigante } } } } })?.titulo?.length,
  300,
);
conferir(
  "campo em branco vira null, não string vazia",
  extrairAnuncio({ message: { extendedTextMessage: { contextInfo: { externalAdReply: { ...anuncioFb, body: "   " } } } } })?.corpo,
  null,
);

if (falhas.length) {
  console.error(`${falhas.length} verificação(ões) falharam:\n\n${falhas.join("\n\n")}`);
  process.exit(1);
}
console.log(`${passou}/${passou} verificações passaram`);
