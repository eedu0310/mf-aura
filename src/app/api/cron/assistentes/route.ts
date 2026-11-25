import { rodadaDoAgente } from "@/lib/meta/agente";
import { rodadaDoAssistenteDoSite } from "@/lib/site-mf/assistente";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { rodarCron } from "@/lib/cron/execucao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * De 5 em 5 minutos, os dois atendentes automáticos:
 *  - agente de IA do Instagram: direct que esperou mais que o tempo da loja
 *    (padrão 2h) sem resposta da equipe e, se ligado, comentários;
 *  - assistente do chat do site MF: visitante que esperou mais que o tempo
 *    configurado (15 min, 30 min…) dentro do horário.
 *
 * Pelo rodarCron, como os outros crons: a checagem do segredo FECHA quando o
 * CRON_SECRET não está configurado (antes ficava aberta), e cada rodada fica
 * no diário dos crons — é de lá que o escritório dos agentes mostra as mesas
 * "Agente do Instagram" e "Assistente do chat do site".
 */
export async function GET(request: Request) {
  return rodarCron(request, "assistentes", async () => {
    const sb = getSupabaseServiceClient();
    const [instagram, site] = await Promise.all([
      rodadaDoAgente(),
      sb ? rodadaDoAssistenteDoSite(sb).catch(() => 0) : Promise.resolve(0),
    ]);
    return { instagram, site };
  });
}
