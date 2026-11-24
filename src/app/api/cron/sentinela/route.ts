import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { rodarCron } from "@/lib/cron/execucao";
import { rodarSentinelas } from "@/lib/sentinela";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * As Sentinelas (ver lib/sentinela): operação, dados e segurança.
 * Roda de manhã e à tarde pelo cron da VPS; só avisa o que for novo.
 */
export async function GET(request: Request) {
  return rodarCron(request, "sentinela", async () => {
    const sb = getSupabaseServiceClient();
    if (!sb) throw new Error("Supabase não configurado.");
    return rodarSentinelas(sb);
  });
}
