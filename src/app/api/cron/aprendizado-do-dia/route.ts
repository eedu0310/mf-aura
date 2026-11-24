import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { colherAprendizadoDoDia } from "@/lib/aura/aprendizado-diario";
import { rodarCron } from "@/lib/cron/execucao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Rodada noturna de aprendizado (ver lib/aura/aprendizado-diario.ts).
 * Chamada pelo cron da VPS em 127.0.0.1, porque as conversas estão na memória
 * deste processo e não no banco.
 */
export async function GET(request: Request) {
  return rodarCron(request, "aprendizado-do-dia", async () => {
    const sb = getSupabaseServiceClient();
    if (!sb) throw new Error("Supabase não configurado.");
    const lojas = await colherAprendizadoDoDia(sb);
    return { lojas };
  });
}
