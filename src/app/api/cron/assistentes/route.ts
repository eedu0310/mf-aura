import { NextResponse } from "next/server";
import { rodadaDoAgente } from "@/lib/meta/agente";
import { rodadaDoAssistenteDoSite } from "@/lib/site-mf/assistente";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * De 5 em 5 minutos, os dois atendentes automáticos:
 *  - agente de IA do Instagram: direct que esperou mais que o tempo da loja
 *    (padrão 2h) sem resposta da equipe e, se ligado, comentários;
 *  - assistente do chat do site MF: visitante que esperou mais que o tempo
 *    configurado (15 min, 30 min…) dentro do horário.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (segredo && request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }
  const sb = getSupabaseServiceClient();
  const [instagram, site] = await Promise.all([
    rodadaDoAgente(),
    sb ? rodadaDoAssistenteDoSite(sb).catch(() => 0) : Promise.resolve(0),
  ]);
  return NextResponse.json({ ok: true, instagram, site });
}
