/**
 * OS MATERIAIS DA EMPRESA QUE MORAM NO GOOGLE DRIVE (Linktree dos vendedores).
 *
 * Pedido do Elton (27/11/2026): "esse linktree dos vendedores tem muito
 * material; baixe o que não tem no banco, suba para a base de conhecimento e
 * deixe os agentes trabalharem em cima — quero o sistema sabendo de cabo a
 * rabo tudo que trabalhamos, oferecemos e os padrões da empresa".
 *
 * As pastas são públicas por link ("qualquer pessoa com o link"), então não
 * precisa de credencial do Google nenhuma: a listagem vem de
 * drive.google.com/embeddedfolderview e o arquivo de drive.usercontent.
 * Credencial OAuth vence e falha calada (ver src/lib/backup/executar.ts);
 * link público não.
 *
 * Aqui ficam só as REGRAS (testáveis sem rede) e o acesso ao Drive; quem
 * grava na base é o Bibliotecário (src/lib/agentes/nativos/bibliotecario.ts).
 */
import { NOMES_EMPRESAS } from "@/lib/companies";

export interface PastaFonte {
  nome: string;
  id: string;
  /** Material de uso interno (preço, condição): fora dos assistentes que falam com o cliente. */
  interno?: boolean;
}

/**
 * As pastas do Linktree que viram conhecimento. Ficaram DE FORA, de propósito:
 *   - Mídias Gráficas (fotos e vídeos para postar: não é texto);
 *   - Arquivos Técnicos SKP/3DS (blocos 3D para arquiteto);
 *   - Treinamentos (vídeos .mov — sem transcrição por enquanto);
 *   - Realidade Aumentada (só traz o acesso ao app, que é senha, não saber).
 */
export const PASTAS_DO_LINKTREE: PastaFonte[] = [
  { nome: "Manual de Cultura e Padrões Profissionais", id: "1CU_qB-nxZaR9LRXXwGD__f66nlR7iikz" },
  { nome: "Estrutura da Cadência Para Mensagens e Ligações", id: "1uLCTzN1Ld4Ixe9__EHyG0TrCzbVCSqhj" },
  { nome: "Tabelas de preços LF e A&G", id: "1-xckyLBgctvwqPSp28paQhrrqJAaVyDs", interno: true },
  { nome: "Condições Comerciais", id: "1tK1v0MbGI4QPsTg19w0ep2OpewXiIe6a", interno: true },
  { nome: "Apresentações Lojas", id: "1-moh5SNjUNwnV5COsiEou1bDUmiRT7LZ" },
  { nome: "Curso e Especializações", id: "1_W2NS_oxD8LYizIMa6nuN4KxANP19238" },
  { nome: "Procedimentos de Instalação", id: "1Hz2V_KRthiqoknbaU1APdYm6MGIlIUM8" },
  { nome: "Checklist Autorização Instalação", id: "1HaWEcY_gNuujEphjJTYqoNtwS1qCFp4x" },
  { nome: "Regulamentos", id: "1HYNQZrffuzpAH0DpypGakQJovZxq3DnD" },
  { nome: "Catálogos", id: "1vzQufPhFsQC6HdEescOGEW8n73GJJEC6" },
  { nome: "Manuais e Guias Práticos", id: "1Fb5NrSd1pDls8GPj825_naw-Bbwrqk2N" },
  { nome: "Piso Elétrico", id: "1-6q7xJgOxYztpYgFf-FuUhRgezyZLhn3" },
];

export type TipoItem = "pasta" | "arquivo" | "google-document" | "google-spreadsheets" | "google-presentation";

export interface ItemDrive {
  id: string;
  nome: string;
  tipo: TipoItem;
  /** "Apr 17", "10:23 AM"… como o Drive mostra. Muda quando o arquivo muda. */
  modificado: string;
}

export interface ArquivoFonte extends ItemDrive {
  /** "Catálogos / Lareiras Kratki / LAREIRA NBC 7 KW" */
  caminho: string;
  interno: boolean;
}

const desfazer = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/** Lê a página de listagem pública de uma pasta (função pura: testável com HTML salvo). */
export function lerListagem(html: string): ItemDrive[] {
  const itens: ItemDrive[] = [];
  const partes = html.split('class="flip-entry"').slice(1);
  for (const p of partes) {
    const href = desfazer(/<a href="([^"]+)"/.exec(p)?.[1] ?? "");
    const nome = desfazer(/flip-entry-title">([^<]+)/.exec(p)?.[1] ?? "").trim();
    const modificado = desfazer(/flip-entry-last-modified"><div>([^<]*)/.exec(p)?.[1] ?? "").trim();
    if (!href || !nome) continue;
    let r: RegExpExecArray | null;
    if ((r = /\/folders\/([\w-]+)/.exec(href))) itens.push({ id: r[1], nome, tipo: "pasta", modificado });
    else if ((r = /\/file\/d\/([\w-]+)/.exec(href))) itens.push({ id: r[1], nome, tipo: "arquivo", modificado });
    else if ((r = /docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([\w-]+)/.exec(href))) {
      itens.push({ id: r[2], nome, tipo: `google-${r[1]}` as TipoItem, modificado });
    }
  }
  return itens;
}

/** Extensões que viram texto (o resto — foto, vídeo, 3D — fica de fora). */
const EXTENSOES_DE_TEXTO = ["pdf", "docx", "pptx", "xlsx", "txt", "md"];

export function extensao(nome: string): string {
  return (/\.([a-z0-9]{2,5})$/i.exec(nome)?.[1] ?? "").toLowerCase();
}

export function viraTexto(item: Pick<ItemDrive, "nome" | "tipo">): boolean {
  if (item.tipo === "pasta") return false;
  // Google Docs, Planilhas e Apresentações: o Drive exporta como texto.
  if (item.tipo !== "arquivo") return true;
  return EXTENSOES_DE_TEXTO.includes(extensao(item.nome));
}

/** Nome sem extensão, sem acento, sem "Cópia de", sem "(1)": para achar o mesmo documento repetido. */
export function nomeBase(nome: string): string {
  return nome
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/\.(doc|docx)$/i, "")
    .replace(/^c[oó]pia de\s+/i, "")
    .replace(/\(\d+\)/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** Quanto melhor o formato para ler texto, menor o número (Word lê melhor que PDF). */
const PREFERENCIA: Record<string, number> = { docx: 0, md: 0, txt: 0, pptx: 1, xlsx: 1, pdf: 2 };

/**
 * Um arquivo por documento. A pasta "Manuais 2025" repete os manuais que já
 * estão nas pastas de cada linha, e a cadência existe em .docx e .pdf: fica
 * o melhor formato e, empatando, o que está fora da pasta-catálogo genérica.
 */
export function semRepetidos(arquivos: ArquivoFonte[]): ArquivoFonte[] {
  const melhor = new Map<string, ArquivoFonte>();
  const nota = (a: ArquivoFonte) =>
    (a.tipo === "arquivo" ? (PREFERENCIA[extensao(a.nome)] ?? 3) : 0) * 10 + (/manuais 20\d\d/i.test(a.caminho) ? 1 : 0);
  for (const a of arquivos) {
    const chave = `${nomeBase(a.nome)}|${lojasDoArquivo(a.caminho, a.nome).join(",")}`;
    const atual = melhor.get(chave);
    if (!atual || nota(a) < nota(atual)) melhor.set(chave, a);
  }
  return [...melhor.values()];
}

const LF = /(^|[^a-z])lf([^a-z]|$)|lf\s*lareiras/i;
const AG = /a\s*&\s*g|(^|[^a-z])aeg([^a-z]|$)|a&amp;g/i;

/**
 * Para quais lojas vai o arquivo. Decide o trecho MAIS ESPECÍFICO que fala de
 * loja: o nome do arquivo, depois a subpasta mais funda, subindo. "Tabelas
 * LF e A&G / A&G / Tabela AEG 2026.pdf" é só da A&G; "Condições Comerciais –
 * LF AEG 26.pdf" é das duas; o que não fala de loja nenhuma é do grupo todo.
 * "LFAEG" e "AEG/LF" (sem espaço) contam como as duas.
 */
export function lojasDoArquivo(caminho: string, nome: string): string[] {
  const candidatos = [nome, ...caminho.split(" / ").reverse()];
  for (const c of candidatos) {
    const junto = /lf\s*[:/]?\s*aeg|aeg\s*[:/]?\s*lf|aeglf|lfaeg/i.test(c);
    const temLF = junto || LF.test(c);
    const temAG = junto || AG.test(c);
    if (temLF && temAG) return ["LF Lareiras", "A&G Aquecimento"];
    if (temLF) return ["LF Lareiras"];
    if (temAG) return ["A&G Aquecimento"];
  }
  return [...NOMES_EMPRESAS];
}

/** Preço, tabela e condição comercial: uso interno (os assistentes do cliente não leem). */
export function ehInterno(caminho: string, nome: string, pastaInterna: boolean): boolean {
  // Sem acento antes de comparar: o Drive guarda "Preços" às vezes com o ç decomposto (c + cedilha).
  const t = `${caminho} ${nome}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return pastaInterna || /tabela|precos|condicoes comerciais/i.test(t);
}

/** Marca no título de material de uso interno (os trechos herdam pelo "origem"). */
export { MARCA_USO_INTERNO as MARCA_INTERNO } from "@/lib/aura/trechos";

/** Marca na descrição que liga o material ao arquivo do Drive. */
export function marcaDaFonte(id: string, modificado: string): string {
  return `drive:${id} · modificado: ${modificado || "?"}`;
}

export function idDaFonte(descricao: string | null | undefined): string | null {
  return /drive:([\w-]+)/.exec(descricao ?? "")?.[1] ?? null;
}

export function modificadoDaFonte(descricao: string | null | undefined): string | null {
  return /modificado: ([^·\n]+)/.exec(descricao ?? "")?.[1]?.trim() ?? null;
}

/* --------------------------------------------------------------- rede */

const TEMPO_MS = 30_000;

async function buscar(url: string): Promise<Response> {
  const controle = new AbortController();
  const t = setTimeout(() => controle.abort(), TEMPO_MS);
  try {
    return await fetch(url, { signal: controle.signal, redirect: "follow" });
  } finally {
    clearTimeout(t);
  }
}

export async function listarPasta(id: string): Promise<ItemDrive[]> {
  const r = await buscar(`https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(id)}`);
  if (!r.ok) throw new Error(`Drive respondeu ${r.status} ao listar a pasta`);
  return lerListagem(await r.text());
}

/** Todos os arquivos de texto de uma pasta, descendo nas subpastas. */
export async function percorrer(pasta: PastaFonte, prof = 0, caminho = pasta.nome, id = pasta.id): Promise<ArquivoFonte[]> {
  if (prof > 6) return [];
  const saida: ArquivoFonte[] = [];
  for (const it of await listarPasta(id)) {
    if (it.tipo === "pasta") saida.push(...(await percorrer(pasta, prof + 1, `${caminho} / ${it.nome}`, it.id)));
    else if (viraTexto(it)) saida.push({ ...it, caminho, interno: ehInterno(caminho, it.nome, Boolean(pasta.interno)) });
  }
  return saida;
}

/** Acima disto o arquivo não é baixado (catálogo de 100 MB pesa na VPS e raramente tem texto). */
export const MAIOR_ARQUIVO = 40 * 1024 * 1024;

/** Baixa o arquivo (ou exporta o Google Docs/Planilhas/Apresentações como texto). Devolve o nome para o extrator. */
export async function baixar(a: ItemDrive): Promise<{ buffer: Buffer; nomeParaLer: string }> {
  const url =
    a.tipo === "google-document"
      ? `https://docs.google.com/document/d/${a.id}/export?format=txt`
      : a.tipo === "google-spreadsheets"
        ? `https://docs.google.com/spreadsheets/d/${a.id}/export?format=csv`
        : a.tipo === "google-presentation"
          ? `https://docs.google.com/presentation/d/${a.id}/export/txt`
          : `https://drive.usercontent.google.com/download?id=${a.id}&export=download&confirm=t`;
  const r = await buscar(url);
  if (!r.ok) throw new Error(`Drive respondeu ${r.status}`);
  const tamanho = Number(r.headers.get("content-length") ?? 0);
  if (tamanho > MAIOR_ARQUIVO) {
    // Não baixa o corpo: fecha a conexão já com o tamanho do cabeçalho.
    await r.body?.cancel().catch(() => {});
    throw new Error(`arquivo grande demais (${Math.round(tamanho / 1048576)} MB)`);
  }
  const buffer = Buffer.from(await r.arrayBuffer());
  if (buffer.length > MAIOR_ARQUIVO) throw new Error(`arquivo grande demais (${Math.round(buffer.length / 1048576)} MB)`);
  const inicio = buffer.subarray(0, 64).toString("utf8").toLowerCase();
  if (a.tipo === "arquivo" && (inicio.includes("<!doctype html") || inicio.includes("<html"))) {
    throw new Error("o Drive devolveu uma página em vez do arquivo (o link pode ter deixado de ser público)");
  }
  const nomeParaLer =
    a.tipo === "google-spreadsheets" ? `${a.nome}.csv` : a.tipo === "arquivo" ? a.nome : `${a.nome}.txt`;
  return { buffer, nomeParaLer };
}
