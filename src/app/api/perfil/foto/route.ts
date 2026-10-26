import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

/**
 * Foto de perfil da própria pessoa.
 *
 * POST (FormData "foto"): troca. O navegador já manda a foto recortada e
 * reduzida (quadrada, 400 px); aqui só conferimos tipo e tamanho.
 * DELETE: tira a foto e volta às iniciais.
 *
 * Só mexe no perfil de quem está logado. A pasta "avatares" é pública
 * porque a foto aparece no chat do site para o cliente.
 */
const TIPOS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAXIMO = 2 * 1024 * 1024;

function caminhoDaUrl(url: string | null | undefined): string | null {
  const m = (url ?? "").match(/\/storage\/v1\/object\/public\/avatares\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

export async function POST(request: Request) {
  const auth = await getEmpresaAutenticada(request);
  if (!auth) return NextResponse.json({ erro: "Entre na AURA de novo." }, { status: 401 });
  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Sistema indisponível." }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const foto = form?.get("foto");
  if (!(foto instanceof File)) return NextResponse.json({ erro: "Escolha uma foto." }, { status: 400 });
  const ext = TIPOS[foto.type];
  if (!ext) return NextResponse.json({ erro: "Use uma foto JPG, PNG ou WEBP." }, { status: 400 });
  if (foto.size > MAXIMO) return NextResponse.json({ erro: "Foto grande demais (máximo 2 MB)." }, { status: 400 });

  const { data: atual } = await sb.from("profiles").select("foto_url").eq("id", auth.userId).maybeSingle();

  const caminho = `${auth.userId}/${Date.now()}.${ext}`;
  const { error } = await sb.storage
    .from("avatares")
    .upload(caminho, Buffer.from(await foto.arrayBuffer()), { contentType: foto.type, upsert: false, cacheControl: "31536000" });
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const url = sb.storage.from("avatares").getPublicUrl(caminho).data.publicUrl;
  const { error: erroPerfil } = await sb.from("profiles").update({ foto_url: url }).eq("id", auth.userId);
  if (erroPerfil) return NextResponse.json({ erro: erroPerfil.message }, { status: 500 });

  // A foto antiga sai da pasta (cada troca gera um arquivo novo, para o
  // navegador não ficar mostrando a antiga do cache).
  const antiga = caminhoDaUrl(atual?.foto_url);
  if (antiga && antiga.startsWith(`${auth.userId}/`)) await sb.storage.from("avatares").remove([antiga]);

  return NextResponse.json({ ok: true, url });
}

export async function DELETE(request: Request) {
  const auth = await getEmpresaAutenticada(request);
  if (!auth) return NextResponse.json({ erro: "Entre na AURA de novo." }, { status: 401 });
  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Sistema indisponível." }, { status: 503 });

  const { data: atual } = await sb.from("profiles").select("foto_url").eq("id", auth.userId).maybeSingle();
  await sb.from("profiles").update({ foto_url: null }).eq("id", auth.userId);
  const antiga = caminhoDaUrl(atual?.foto_url);
  if (antiga && antiga.startsWith(`${auth.userId}/`)) await sb.storage.from("avatares").remove([antiga]);
  return NextResponse.json({ ok: true });
}
