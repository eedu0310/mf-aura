import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { executarSupervisaoAura } from "@/lib/aura-supervisor";
import { rodarCron } from "@/lib/cron/execucao";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  return rodarCron(request, "supervisao-aura", async () => {
    const supabase = getSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase não configurado.");
    const resultados = await executarSupervisaoAura(supabase);
    return { executados: resultados.length, resultados };
  });
}
