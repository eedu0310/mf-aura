import { NextResponse } from "next/server";
import sharp from "sharp";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { equipeDoSite } from "@/lib/site-mf/servidor";
import { CDN_BITRIX, LOGO_MF, caminhoDaCopia, fotosDoBitrix } from "@/lib/site-mf/materiais";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Copia para a AURA as fotos que ainda vêm do Bitrix: as das páginas de
 * materiais (manuais, blocos, topo das páginas), o logo e as fotos de fundo
 * dos formulários. Assim nada quebra quando o Bitrix for cancelado.
 *
 * As fotos chegam com 1600 px; aqui viram WEBP de até 800 px (a página fica
 * muito mais leve). Pode rodar de novo quando quiser: o que já foi copiado
 * é pulado. Só a equipe da MF chama.
 */
export async function POST(request: Request) {
  const auth = await equipeDoSite(request);
  if (!auth) return NextResponse.json({ erro: "Só a equipe da MF usa esta área." }, { status: 403 });
  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Sistema indisponível." }, { status: 503 });

  const { data: formularios } = await sb.from("site_formularios").select("id, imagem_fundo");
  const fundos = (formularios ?? []).map((f) => f.imagem_fundo as string | null).filter((u): u is string => !!u?.startsWith(CDN_BITRIX));
  const urls = [...new Set([...fotosDoBitrix(), ...fundos])];

  const { data: existentes } = await sb.storage.from("site").list("materiais", { limit: 1000 });
  const ja = new Set((existentes ?? []).map((a) => `materiais/${a.name}`));

  let copiadas = 0;
  const falhas: string[] = [];
  const fila = urls.filter((u) => {
    const c = caminhoDaCopia(u);
    return c && !ja.has(c);
  });

  // Quatro por vez, para não pesar o servidor.
  for (let i = 0; i < fila.length; i += 4) {
    await Promise.all(
      fila.slice(i, i + 4).map(async (url) => {
        const caminho = caminhoDaCopia(url)!;
        try {
          const r = await fetch(url);
          if (!r.ok) throw new Error(String(r.status));
          const original = Buffer.from(await r.arrayBuffer());
          const logo = url === LOGO_MF;
          const pronto = logo
            ? await sharp(original).resize({ height: 160, withoutEnlargement: true }).png().toBuffer()
            : await sharp(original).resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
          const { error } = await sb.storage
            .from("site")
            .upload(caminho, pronto, { contentType: logo ? "image/png" : "image/webp", upsert: true, cacheControl: "31536000" });
          if (error) throw new Error(error.message);
          copiadas++;
          ja.add(caminho);
        } catch {
          falhas.push(url);
        }
      }),
    );
  }

  // Formulários e logo do chat passam a usar a cópia.
  const publica = (url: string) => {
    const c = caminhoDaCopia(url);
    return c && ja.has(c) ? sb.storage.from("site").getPublicUrl(c).data.publicUrl : null;
  };
  let formulariosTrocados = 0;
  for (const f of formularios ?? []) {
    const nova = f.imagem_fundo ? publica(f.imagem_fundo as string) : null;
    if (nova) {
      await sb.from("site_formularios").update({ imagem_fundo: nova }).eq("id", f.id);
      formulariosTrocados++;
    }
  }
  const logo = publica(LOGO_MF);
  if (logo) {
    const { data: config } = await sb.from("site_chat_config").select("logo_url").eq("empresa", "MF International").maybeSingle();
    const atual = (config?.logo_url as string | null) ?? null;
    if (config && (!atual || atual.startsWith(CDN_BITRIX))) {
      await sb.from("site_chat_config").update({ logo_url: logo }).eq("empresa", "MF International");
    }
  }

  return NextResponse.json({ ok: true, total: urls.length, copiadas, jaEstavam: urls.length - fila.length, falhas, formulariosTrocados });
}
