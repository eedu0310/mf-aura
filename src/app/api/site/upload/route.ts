import { NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { equipeDoSite } from "@/lib/site-mf/servidor";

export const runtime = "nodejs";

/**
 * Sobe imagem de LP ou material (PDF) para a pasta pública "site".
 * Público de propósito: a LP e o material entregue são para o cliente abrir.
 * Por isso só a equipe da MF sobe, e só imagem ou PDF, até 15 MB.
 */
const TIPOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};
const MAXIMO = 15 * 1024 * 1024;

/**
 * Endereço que não pode sair daqui: loopback, rede interna, link-local
 * (169.254.169.254 é o metadado da nuvem), CGNAT, multicast e afins.
 */
function enderecoInterno(ip: string): boolean {
  const v = ip.toLowerCase();
  if (isIP(v) === 4) {
    const [a, b] = v.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  if (isIP(v) === 6) {
    if (v === "::" || v === "::1") return true;
    const mapeado = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapeado) return enderecoInterno(mapeado[1]);
    // ::ffff:7f00:1 (forma hexa do mapeado) e afins: na dúvida, recusa.
    if (v.startsWith("::ffff:")) return true;
    return /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith("ff");
  }
  return true;
}

/**
 * Baixa a imagem de um link com as travas que faltavam. Antes era um
 * fetch(url) cru: seguia redirecionamento, aceitava "https://127.0.0.1" ou o
 * metadado da nuvem e lia o corpo inteiro na memória antes de olhar o
 * tamanho — qualquer conta da equipe fazia o servidor buscar um endereço
 * interno e publicar a resposta na pasta pública.
 *
 * Devolve o arquivo, ou o motivo da recusa em português.
 */
async function baixarDoLink(bruto: string): Promise<File | string> {
  let url: URL;
  try {
    url = new URL(bruto);
  } catch {
    return "Link inválido.";
  }
  if (url.protocol !== "https:") return "Informe um link https.";
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return "Esse endereço não é permitido.";
  }
  if (isIP(host)) {
    if (enderecoInterno(host)) return "Esse endereço não é permitido.";
  } else {
    // Nome que aponta para dentro (127.0.0.1.nip.io e afins) também não passa.
    // Não fecha a corrida de DNS (o fetch resolve de novo), mas tira o caso fácil.
    const enderecos = await lookup(host, { all: true }).catch(() => []);
    if (!enderecos.length) return "Não encontrei esse endereço.";
    if (enderecos.some((e) => enderecoInterno(e.address))) return "Esse endereço não é permitido.";
  }

  try {
    const r = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
    // Redirecionamento é recusado: o destino final escaparia das travas acima.
    if (r.status >= 300 && r.status < 400) return "Esse link redireciona; use o endereço final da imagem.";
    if (!r.ok || !r.body) return "Não consegui baixar a imagem desse link.";
    const tipo = (r.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!TIPOS[tipo]) return "Use imagem (JPG, PNG, WEBP) ou PDF.";
    if (Number(r.headers.get("content-length") ?? 0) > MAXIMO) return "Arquivo maior que 15 MB.";

    // Lê aos pedaços e para no limite: o content-length pode mentir ou faltar.
    const leitor = r.body.getReader();
    const pedacos: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAXIMO) {
        await leitor.cancel().catch(() => {});
        return "Arquivo maior que 15 MB.";
      }
      pedacos.push(value);
    }
    let nome = "imagem";
    try {
      nome = decodeURIComponent(url.pathname.split("/").pop() || "imagem");
    } catch {
      // "%E0" solto no caminho: fica o nome genérico.
    }
    return new File(pedacos as BlobPart[], nome, { type: tipo });
  } catch {
    // Inclui o estouro dos 15 segundos (AbortSignal.timeout).
    return "Não consegui baixar a imagem desse link.";
  }
}

export async function POST(request: Request) {
  const auth = await equipeDoSite(request);
  if (!auth) return NextResponse.json({ erro: "Só a equipe da MF usa esta área." }, { status: 403 });
  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Sistema indisponível." }, { status: 503 });

  /**
   * Também aceita { url } em JSON: traz a imagem de outro endereço para a
   * pasta da AURA (usado para tirar as fotos das páginas antigas do Bitrix
   * antes de cancelar o Bitrix).
   */
  let arquivo: File | null = null;
  if ((request.headers.get("content-type") ?? "").includes("application/json")) {
    const { url } = (await request.json().catch(() => ({}))) as { url?: string };
    if (typeof url !== "string" || !url) return NextResponse.json({ erro: "Informe um link https." }, { status: 400 });
    const baixado = await baixarDoLink(url);
    if (typeof baixado === "string") return NextResponse.json({ erro: baixado }, { status: 400 });
    arquivo = baixado;
  } else {
    const form = await request.formData().catch(() => null);
    const campo = form?.get("arquivo");
    if (campo instanceof File) arquivo = campo;
  }
  if (!arquivo) return NextResponse.json({ erro: "Escolha um arquivo." }, { status: 400 });
  const ext = TIPOS[arquivo.type];
  if (!ext) return NextResponse.json({ erro: "Use imagem (JPG, PNG, WEBP) ou PDF." }, { status: 400 });
  if (arquivo.size > MAXIMO) return NextResponse.json({ erro: "Arquivo maior que 15 MB." }, { status: 400 });

  const base = arquivo.name
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "arquivo";
  const caminho = `mf/${Date.now()}-${base}.${ext}`;

  const { error } = await sb.storage
    .from("site")
    .upload(caminho, Buffer.from(await arquivo.arrayBuffer()), { contentType: arquivo.type, upsert: false });
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const { data } = sb.storage.from("site").getPublicUrl(caminho);
  return NextResponse.json({ url: data.publicUrl });
}
