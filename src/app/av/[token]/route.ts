import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Link curto que o vendedor manda para o cliente.
 *
 * Existe para transformar "eu mandei o link" em fato verificável: quando o
 * cliente abre, marcamos a hora e só então mandamos ele para o Google. Sem
 * isso o sistema teria que acreditar na palavra do vendedor.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.redirect("https://www.google.com");

  const { data: pedido } = await sb
    .from("pedidos_avaliacao")
    .select("id, empresa, canal, aberto_em")
    .eq("token", token)
    .maybeSingle();

  if (!pedido) return NextResponse.redirect("https://www.google.com");

  // Só a primeira abertura conta; recarregar a página não infla o número.
  if (!pedido.aberto_em) {
    await sb
      .from("pedidos_avaliacao")
      .update({ aberto_em: new Date().toISOString() })
      .eq("id", pedido.id);
  }

  const { data: config } = await sb
    .from("config_avaliacao")
    .select("link_google, link_instagram, link_facebook")
    .eq("empresa", pedido.empresa)
    .maybeSingle();

  const destino =
    pedido.canal === "instagram"
      ? config?.link_instagram
      : pedido.canal === "facebook"
        ? config?.link_facebook
        : config?.link_google;

  return NextResponse.redirect(destino || "https://www.google.com");
}
