import type { SupabaseClient } from "@supabase/supabase-js";
import { chaveDaCampanha, nomeDaCampanha, type AnuncioDeOrigem } from "@/lib/whatsapp/anuncio";
import type { WaMessage } from "@/lib/whatsapp/live-manager";

/**
 * Da conversa para a aba de marketing.
 *
 * A estrutura de atribuição já existia inteira no banco — campanhas_marketing
 * ligada a relacionamentos, oportunidades, atividades e vendas — e estava
 * completamente vazia: 257 relacionamentos, todos com origem_lead nulo.
 * Nunca faltou onde guardar; faltava quem preenchesse.
 */

/**
 * O anúncio que deu origem à conversa.
 *
 * Vale a PRIMEIRA mensagem do cliente que trouxer carimbo, não a última: se a
 * pessoa clicar num segundo anúncio semanas depois, o lead continua sendo do
 * anúncio que o trouxe. Trocar a origem no meio do caminho faria o relatório
 * creditar a venda ao anúncio errado.
 */
export function anuncioDaConversa(msgs: WaMessage[]): AnuncioDeOrigem | null {
  const comAnuncio = msgs
    .filter((m) => !m.fromMe && m.anuncio)
    .sort((a, b) => a.timestamp - b.timestamp);
  return comAnuncio[0]?.anuncio ?? null;
}

/**
 * Acha (ou cria) a campanha daquele anúncio e devolve o id.
 *
 * Quem resolve é uma função do banco, não duas consultas daqui: duas análises
 * simultâneas do mesmo anúncio criariam duas campanhas iguais, e o relatório
 * mostraria o anúncio partido ao meio, com metade dos leads em cada.
 */
export async function resolverCampanha(
  sb: SupabaseClient,
  empresa: string,
  criadoPor: string,
  anuncio: AnuncioDeOrigem,
): Promise<string | null> {
  const chave = chaveDaCampanha(anuncio);
  if (!chave || !empresa || !criadoPor) return null;

  const { data, error } = await sb.rpc("campanha_do_anuncio", {
    p_empresa: empresa,
    p_chave: chave,
    p_nome: nomeDaCampanha(anuncio),
    p_canal: anuncio.plataforma,
    p_criado_por: criadoPor,
  });
  if (error) {
    // Não derruba a análise da conversa por causa da campanha: o atendimento
    // é mais importante que a etiqueta. Mas registra, para não sumir calado.
    console.error("[marketing] campanha do anúncio:", error.message);
    return null;
  }
  return typeof data === "string" ? data : null;
}

/** Os campos que a conversa guarda sobre o anúncio de origem. */
export function camposDoAnuncio(anuncio: AnuncioDeOrigem, campanhaId: string | null) {
  return {
    anuncio_titulo: anuncio.titulo,
    anuncio_id: anuncio.anuncioId,
    anuncio_url: anuncio.url,
    anuncio_plataforma: anuncio.plataforma,
    anuncio_clique_id: anuncio.cliqueId,
    campanha_id: campanhaId,
  };
}
