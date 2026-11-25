import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { colherAprendizadoDoDia } from "@/lib/aura/aprendizado-diario";
import { rodarCron } from "@/lib/cron/execucao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Rodada de aprendizado, agora semanal: domingo às 21h (ver
 * lib/aura/aprendizado-diario.ts). Chamada pelo cron da VPS em 127.0.0.1,
 * porque as conversas estão na memória deste processo e não no banco.
 * ?forcar=1 roda fora do domingo. O nome no diário dos crons continua
 * "aprendizado-do-dia" para a Sentinela não perder o histórico.
 */
export async function GET(request: Request) {
  const forcar = new URL(request.url).searchParams.get("forcar") === "1";
  return rodarCron(request, "aprendizado-do-dia", async () => {
    const sb = getSupabaseServiceClient();
    if (!sb) throw new Error("Supabase não configurado.");
    const lojas = await colherAprendizadoDoDia(sb, { forcar });
    return { lojas };
  });
}
