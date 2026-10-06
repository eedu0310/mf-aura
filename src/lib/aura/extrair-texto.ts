/**
 * Extrai o texto de um arquivo enviado pelo gestor (manual, playbook, tabela
 * de produtos) para a AURA estudar. Sem dependências novas:
 *  - .txt / .md / .csv / .json → texto direto
 *  - .docx                     → descompacta com jszip e lê word/document.xml
 *  - .pptx                     → o mesmo, lendo o texto de cada slide
 *  - .pdf                      → pdf.js, a mesma biblioteca do navegador, que
 *                                lê o mapa de caracteres das fontes embutidas
 *                                (PDF que é foto/digitalização não tem texto)
 */

export interface TextoExtraido {
  texto: string;
  aviso?: string;
}

const limpar = (s: string) =>
  s
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .trim();

// ---------------------------------------------------------------- docx

async function doDocx(buffer: Buffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const partes: string[] = [];
  for (const nome of ["word/document.xml", "word/footnotes.xml", "word/endnotes.xml"]) {
    const arquivo = zip.file(nome);
    if (!arquivo) continue;
    const xml = await arquivo.async("string");
    partes.push(
      xml
        .replace(/<w:tab[^>]*\/>/g, "\t")
        .replace(/<\/w:p>/g, "\n")
        .replace(/<w:br[^>]*\/>/g, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'"),
    );
  }
  return limpar(partes.join("\n"));
}

// ---------------------------------------------------------------- pptx

/**
 * Texto de uma apresentação do PowerPoint.
 *
 * Um .pptx é um zip de XML, igual ao .docx: cada slide é um arquivo e o texto
 * fica nas marcas <a:t>. Entrou aqui porque o material de treinamento da casa
 * é feito em slides, e até agora a única saída era exportar para PDF — que é
 * justamente onde a leitura quebrava.
 *
 * Os slides vão em ordem numérica, e não na ordem em que o zip os guarda:
 * "slide10" vem depois de "slide9", não entre "slide1" e "slide2".
 */
async function doPptx(buffer: Buffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);

  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)/)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)/)?.[1] ?? 0);
      return na - nb;
    });

  const partes: string[] = [];
  for (const [i, nome] of slides.entries()) {
    const xml = await zip.file(nome)!.async("string");
    const textos = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) =>
      m[1]
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'"),
    );
    const texto = textos.join(" ").trim();
    if (texto) partes.push(`[Slide ${i + 1}] ${texto}`);
  }

  // As anotações do apresentador costumam ter o roteiro da fala — para
  // treinamento, muitas vezes valem mais do que o que está escrito no slide.
  const notas = Object.keys(zip.files)
    .filter((n) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n))
    .sort();
  for (const nome of notas) {
    const xml = await zip.file(nome)!.async("string");
    const texto = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
      .map((m) => m[1])
      .join(" ")
      .trim();
    if (texto.length > 20) partes.push(`[Anotações] ${texto}`);
  }

  return limpar(partes.join("\n\n"));
}

// ---------------------------------------------------------------- pdf

/**
 * Lê o PDF com a pdf.js, a mesma biblioteca que o navegador usa.
 *
 * POR QUE TROCAMOS O LEITOR CASEIRO. O anterior lia os operadores de texto na
 * mão e funcionava em PDF de fonte padrão. Em PDF feito a partir de slides —
 * Canva, Google Apresentações, InDesign — a fonte vai embutida e com
 * codificação própria: cada letra é um número que só o mapa ToUnicode daquele
 * arquivo sabe traduzir. Sem ler esse mapa, o que sai parece texto mas é
 * ruído.
 *
 * NÃO É TEORIA: o "Manual de Vendas LF/AEG 2026", 7,1 MB, entrou no sistema
 * como 14 mil caracteres de "GÁ­¹Ý~ ­O-F-¥ fTfxfÓIþfTJ±ûàÓfÓ..." — e, pior,
 * entrou ATIVO nas quatro lojas. Era isso que a AURA recebia como "a regra da
 * casa" em toda conversa: ocupando espaço do prompt e ensinando ruído.
 */
async function doPdf(buffer: Buffer): Promise<TextoExtraido> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    // Sem worker: isto roda no servidor, não no navegador.
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const paginas: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const conteudo = await pagina.getTextContent();

    /**
     * A pdf.js devolve pedaços soltos com a posição de cada um. Juntar sem
     * olhar a posição cola palavras de colunas diferentes; por isso a quebra
     * de linha vem do "hasEOL" que ela marca, e o espaço só entra quando o
     * pedaço anterior não terminou em espaço.
     */
    let texto = "";
    for (const item of conteudo.items as { str?: string; hasEOL?: boolean }[]) {
      const pedaco = item.str ?? "";
      if (pedaco) {
        if (texto && !/\s$/.test(texto) && !/^\s/.test(pedaco)) texto += " ";
        texto += pedaco;
      }
      if (item.hasEOL) texto += "\n";
    }
    const limpo = texto.trim();
    if (limpo) paginas.push(limpo);
  }
  await doc.destroy();

  const texto = limpar(paginas.join("\n\n"));

  if (texto.length < 200) {
    return {
      texto,
      aviso:
        "Quase não havia texto neste PDF (pode ser um documento digitalizado, só com imagens). Se possível, envie em Word (.docx) ou texto (.txt).",
    };
  }
  if (!pareceTextoDeVerdade(texto)) {
    return {
      texto: "",
      aviso:
        "Consegui abrir o PDF, mas o que saiu não é texto legível — normalmente é PDF com fonte embutida sem mapa de caracteres, ou digitalizado. Envie em Word (.docx) ou texto (.txt) e ele entra perfeito.",
    };
  }
  return { texto };
}

/**
 * O texto saiu legível, ou saiu ruído?
 *
 * Existe porque guardar ruído é pior do que recusar o arquivo: ele vira
 * "manual da casa" e viaja no prompt da AURA em toda conversa, gastando
 * espaço e ensinando o que não existe — foi exatamente o que aconteceu com o
 * manual de vendas. A medida é grosseira de propósito: em português corrido,
 * a esmagadora maioria dos caracteres é letra, espaço ou pontuação comum, e
 * as vogais aparecem em quase toda palavra.
 */
function pareceTextoDeVerdade(texto: string): boolean {
  const amostra = texto.slice(0, 4000);
  if (!amostra) return false;

  const comuns = (amostra.match(/[\p{L}\p{N}\s.,;:!?()%$@/\-–—"'ºª]/gu) ?? []).length;
  const proporcao = comuns / amostra.length;

  const letras = (amostra.match(/\p{L}/gu) ?? []).length;
  const vogais = (amostra.match(/[aeiouáàâãéêíóôõúüAEIOUÁÀÂÃÉÊÍÓÔÕÚÜ]/gu) ?? []).length;
  const proporcaoVogais = letras ? vogais / letras : 0;

  // Texto em português fica perto de 0,97 de caracteres comuns e 0,40 de
  // vogais; o ruído do manual quebrado ficava em 0,78 e 0,16.
  return proporcao >= 0.90 && proporcaoVogais >= 0.28;
}

// ---------------------------------------------------------------- entrada

export async function extrairTexto(nome: string, tipo: string, buffer: Buffer): Promise<TextoExtraido> {
  const ext = (nome.split(".").pop() ?? "").toLowerCase();

  if (ext === "docx" || tipo.includes("wordprocessingml")) {
    const texto = await doDocx(buffer);
    if (!texto) throw new Error("Não consegui ler o conteúdo deste Word.");
    return { texto };
  }
  if (ext === "pptx" || tipo.includes("presentationml")) {
    const texto = await doPptx(buffer);
    if (!texto) throw new Error("Não achei texto nesta apresentação — os slides podem ser só imagens.");
    return { texto };
  }
  if (ext === "pdf" || tipo === "application/pdf") return await doPdf(buffer);
  if (ext === "doc") {
    throw new Error("Formato .doc antigo não é suportado. Salve como .docx ou PDF e envie de novo.");
  }
  if (["txt", "md", "markdown", "csv", "json", "html", "htm"].includes(ext) || tipo.startsWith("text/")) {
    let texto = buffer.toString("utf8");
    if (["html", "htm"].includes(ext)) {
      texto = texto
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ");
    }
    return { texto: limpar(texto) };
  }
  throw new Error(
    "Tipo de arquivo não suportado. Envie PDF, Word (.docx), PowerPoint (.pptx), texto (.txt) ou markdown (.md).",
  );
}
