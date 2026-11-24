import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { religarSessoesSalvas } from "@/lib/whatsapp/live-manager";
import { rodarCron } from "@/lib/cron/execucao";

export const runtime = "nodejs";

/**
 * Roda automaticamente a cada 5 minutos.
 *
 * Faz duas coisas: repassa pro vendedor qualquer lead cujo prazo do SDR tenha
 * vencido sem resposta, e garante que as sessões de WhatsApp da equipe estão
 * de pé.
 *
 * O religamento mora AQUI, e não num cron próprio, de propósito: cron novo
 * exigiria reinstalar o /etc/cron.d/aura no servidor, e um passo manual a mais
 * é um passo a mais para esquecer. Este já roda de cinco em cinco minutos.
 *
 * É a rede de segurança do religamento do boot (src/instrumentation.ts). Se
 * uma sessão cair fora de um deploy — queda de rede, WhatsApp derrubando a
 * conexão —, ela volta sozinha em no máximo cinco minutos, sem ninguém
 * precisar abrir tela nenhuma. Quem o vendedor desconectou de propósito
 * continua desconectado: o religamento respeita essa escolha.
 */
export async function GET(request: Request) {
  return rodarCron(request, "repassar-leads", async () => {
    const supabase = getSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase não configurado.");

    const { data, error } = await supabase.rpc("repassar_leads_expirados");
    if (error) throw new Error(`Erro ao repassar leads expirados: ${error.message}`);

    /**
     * Nunca derruba o cron: se o religamento falhar, os leads já foram
     * repassados e isso é o que não pode deixar de acontecer.
     */
    const whatsapp = await religarSessoesSalvas().catch((e) => {
      console.error("[cron] religamento do WhatsApp falhou:", e);
      return { religadas: [], jaAtivas: [] };
    });

    return {
      leadsRepassados: data ?? 0,
      whatsapp: { religadas: whatsapp.religadas.length, jaAtivas: whatsapp.jaAtivas.length },
    };
  });
}
