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
/**
 * Robô que abre o link para montar a pré-visualização (WhatsApp, Facebook,
 * Telegram…) não é o cliente: contava como "avaliação recebida" segundos
 * depois do envio (27/11/2026).
 */
const ROBO = /whatsapp|facebookexternalhit|facebot|telegrambot|twitterbot|slackbot|discordbot|linkedinbot|bot\b|crawler|spider|preview/i;

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ehRobo = ROBO.test(req.headers.get("user-agent") ?? "");
  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.redirect("https://www.google.com");

  const { data: pedido } = await sb
    .from("pedidos_avaliacao")
    .select("id, empresa, canal, aberto_em, enviado_em")
    .eq("token", token)
    .maybeSingle();

  if (!pedido) return NextResponse.redirect("https://www.google.com");

  // Só a primeira abertura conta; recarregar a página não infla o número.
  // O robô da pré-visualização não marca nada.
  if (!pedido.aberto_em && !ehRobo) {
    const agora = new Date().toISOString();
    await sb
      .from("pedidos_avaliacao")
      // Se o cliente abriu, o link foi enviado — mesmo que o envio não tenha
      // sido registrado (mandado por outro caminho). Conta para o vendedor.
      .update({ aberto_em: agora, ...(pedido.enviado_em ? {} : { enviado_em: agora }) })
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
