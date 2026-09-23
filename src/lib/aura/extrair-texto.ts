/**
 * Extrai o texto de um arquivo enviado pelo gestor (manual, playbook, tabela
 * de produtos) para a AURA estudar. Sem dependências novas:
 *  - .txt / .md / .csv / .json → texto direto
 *  - .docx                     → descompacta com jszip e lê word/document.xml
 *  - .pdf                      → descomprime os fluxos e lê os operadores de
 *                                texto (funciona em PDF de texto; PDF que é
 *                                foto/digitalização não tem texto para ler)
 */
import zlib from "zlib";

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

// ---------------------------------------------------------------- pdf

/** Converte uma string literal de PDF — (texto com \( escapes e \303\251) — em texto. */
function stringDePdf(bruto: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < bruto.length; i++) {
    const c = bruto[i];
    if (c !== "\\") {
      bytes.push(bruto.charCodeAt(i));
      continue;
    }
    const prox = bruto[++i];
    if (prox === undefined) break;
    if (prox >= "0" && prox <= "7") {
      let oct = prox;
      while (oct.length < 3 && bruto[i + 1] >= "0" && bruto[i + 1] <= "7") oct += bruto[++i];
      bytes.push(parseInt(oct, 8));
    } else if (prox === "n") bytes.push(10);
    else if (prox === "r") bytes.push(13);
    else if (prox === "t") bytes.push(9);
    else if (prox === "\n") continue;
    else bytes.push(prox.charCodeAt(0));
  }
  const buf = Buffer.from(bytes);
  // PDFs costumam usar UTF-16BE (com BOM) ou Latin-1/WinAnsi.
  if (buf[0] === 0xfe && buf[1] === 0xff) return buf.subarray(2).swap16().toString("utf16le");
  const utf8 = buf.toString("utf8");
  return utf8.includes("�") ? buf.toString("latin1") : utf8;
}

/** Lê os operadores de texto (Tj, TJ, ', ") de um fluxo de conteúdo. */
function textoDoFluxo(conteudo: string): string {
  const linhas: string[] = [];
  let atual = "";
  const re = /\((?:\\.|[^\\()])*\)\s*(Tj|TJ|'|")|\[((?:\\.|[^\\\]])*)\]\s*TJ|\bT\*|\bTd\b|\bTD\b|\bTL\b|\bET\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(conteudo))) {
    const trecho = m[0];
    if (trecho.startsWith("[")) {
      const interno = m[2] ?? "";
      let texto = "";
      const reStr = /\((?:\\.|[^\\()])*\)|(-?\d+(?:\.\d+)?)/g;
      let s: RegExpExecArray | null;
      while ((s = reStr.exec(interno))) {
        if (s[0].startsWith("(")) texto += stringDePdf(s[0].slice(1, -1));
        else if (Number(s[1]) < -120) texto += " "; // espaçamento grande = espaço
      }
      atual += texto;
    } else if (trecho.startsWith("(")) {
      atual += stringDePdf(trecho.slice(1, trecho.lastIndexOf(")")));
    } else {
      // T*, Td, TD, ET → quebra de linha
      if (atual.trim()) linhas.push(atual.trim());
      atual = "";
    }
  }
  if (atual.trim()) linhas.push(atual.trim());
  return linhas.join("\n");
}

/** ASCII85 (usado por várias ferramentas antes do Flate). */
function deAscii85(dados: Buffer): Buffer | null {
  let txt = dados.toString("latin1").replace(/\s/g, "");
  if (txt.startsWith("<~")) txt = txt.slice(2);
  const fim = txt.indexOf("~>");
  if (fim !== -1) txt = txt.slice(0, fim);
  if (!/^[!-u z]*$/.test(txt)) return null;
  const out: number[] = [];
  let grupo: number[] = [];
  for (const c of txt) {
    if (c === "z" && grupo.length === 0) {
      out.push(0, 0, 0, 0);
      continue;
    }
    const v = c.charCodeAt(0) - 33;
    if (v < 0 || v > 84) return null;
    grupo.push(v);
    if (grupo.length === 5) {
      let n = 0;
      for (const g of grupo) n = n * 85 + g;
      out.push((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
      grupo = [];
    }
  }
  if (grupo.length) {
    const faltam = 5 - grupo.length;
    for (let k = 0; k < faltam; k++) grupo.push(84);
    let n = 0;
    for (const g of grupo) n = n * 85 + g;
    const bytes = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    out.push(...bytes.slice(0, 4 - faltam));
  }
  return Buffer.from(out);
}

/** Tenta as combinações de filtro mais comuns até achar texto legível. */
function descomprimir(dados: Buffer): string {
  const tentativas: (() => Buffer)[] = [
    () => zlib.inflateSync(dados),
    () => zlib.inflateRawSync(dados),
    () => {
      const a85 = deAscii85(dados);
      if (!a85) throw new Error("não é ascii85");
      try {
        return zlib.inflateSync(a85);
      } catch {
        return a85;
      }
    },
    () => dados,
  ];
  for (const tentar of tentativas) {
    try {
      const saida = tentar().toString("latin1");
      if (/\)\s*Tj|\]\s*TJ/.test(saida)) return saida;
    } catch {
      /* próxima tentativa */
    }
  }
  return "";
}

function doPdf(buffer: Buffer): TextoExtraido {
  const partes: string[] = [];
  const marcador = Buffer.from("stream");
  let i = 0;
  while (true) {
    const ini = buffer.indexOf(marcador, i);
    if (ini === -1) break;
    let inicioDados = ini + marcador.length;
    if (buffer[inicioDados] === 0x0d) inicioDados++;
    if (buffer[inicioDados] === 0x0a) inicioDados++;
    const fim = buffer.indexOf(Buffer.from("endstream"), inicioDados);
    if (fim === -1) break;
    const dados = buffer.subarray(inicioDados, fim);
    i = fim + 9;
    const conteudo = descomprimir(dados);
    if (conteudo) partes.push(textoDoFluxo(conteudo));
  }
  const texto = limpar(partes.join("\n"));
  if (texto.length < 200) {
    return {
      texto,
      aviso:
        "Quase não havia texto neste PDF (pode ser um documento digitalizado, só com imagens). Se possível, envie em Word (.docx) ou texto (.txt).",
    };
  }
  return { texto };
}

// ---------------------------------------------------------------- entrada

export async function extrairTexto(nome: string, tipo: string, buffer: Buffer): Promise<TextoExtraido> {
  const ext = (nome.split(".").pop() ?? "").toLowerCase();

  if (ext === "docx" || tipo.includes("wordprocessingml")) {
    const texto = await doDocx(buffer);
    if (!texto) throw new Error("Não consegui ler o conteúdo deste Word.");
    return { texto };
  }
  if (ext === "pdf" || tipo === "application/pdf") return doPdf(buffer);
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
  throw new Error("Tipo de arquivo não suportado. Envie PDF, Word (.docx), texto (.txt) ou markdown (.md).");
}
