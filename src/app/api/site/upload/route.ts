import { NextResponse } from "next/server";
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
    if (!url || !/^https:\/\//.test(url)) return NextResponse.json({ erro: "Informe um link https." }, { status: 400 });
    const r = await fetch(url).catch(() => null);
    if (!r?.ok) return NextResponse.json({ erro: "Não consegui baixar a imagem desse link." }, { status: 400 });
    const tipo = (r.headers.get("content-type") ?? "").split(";")[0].trim();
    const nome = decodeURIComponent(new URL(url).pathname.split("/").pop() || "imagem");
    arquivo = new File([await r.arrayBuffer()], nome, { type: tipo });
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
