/**
 * Roda uma vez quando o servidor sobe (gancho oficial do Next).
 *
 * Existe por um motivo só: religar as sessões de WhatsApp da equipe depois de
 * um deploy. Antes disto, todo `systemctl restart aura` desconectava todo
 * mundo em silêncio, e cada vendedor só voltava quando abria a tela de
 * WhatsApp no CRM — um por um, sem aviso. Enquanto não abrissem, a AURA ficava
 * cega: não analisava conversa, não criava lead, não alertava ninguém.
 */
export async function register() {
  // O gancho também roda no runtime edge, onde não há disco nem WhatsApp.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Import dinâmico: fora do Node este módulo nem deve ser carregado.
  const { religarSessoesSalvas } = await import("@/lib/whatsapp/live-manager");

  /**
   * Sem await no register: ele segura o start do servidor, e religar dez
   * sessões com espaçamento leva dezenas de segundos. O servidor sobe e
   * atende normalmente enquanto as sessões voltam por trás.
   */
  void religarSessoesSalvas().catch((e) =>
    console.error("[instrumentation] religamento do WhatsApp falhou:", e),
  );
}
