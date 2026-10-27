import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { colherAprendizadoDoDia } from "@/lib/aura/aprendizado-diario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Rodada noturna de aprendizado (ver lib/aura/aprendizado-diario.ts).
 * Chamada pelo cron da VPS em 127.0.0.1, porque as conversas estão na memória
 * deste processo e não no banco.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  const autorizacao = request.headers.get("authorization");
  if (!segredo || autorizacao !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Supabase não configurado." }, { status: 500 });

  try {
    const lojas = await colherAprendizadoDoDia(sb);
    return NextResponse.json({ ok: true, lojas });
  } catch (erro) {
    console.error("[cron/aprendizado-do-dia]", erro);
    return NextResponse.json({ erro: "Não foi possível rodar o aprendizado do dia." }, { status: 500 });
  }
}
