/**
 * O pedido de avaliação, num lugar só: o modal do pós-venda e a seção
 * Avaliações usam o mesmo link e a mesma mensagem de WhatsApp.
 *
 * O link é a página pública /avaliar/<token>; o token já vem em cada
 * pós-venda. O WhatsApp é um link wa.me comum: só abre a conversa com o texto
 * pronto, quem manda é a pessoa.
 */
import type { PosVenda } from "@/lib/supabase/pos-venda";

export function linkAvaliacao(token: string) {
  return `${window.location.origin}/avaliar/${token}`;
}

export function linkWhatsAppAvaliacao(pv: Pick<PosVenda, "telefone" | "tokenAvaliacao">) {
  const numero = pv.telefone?.replace(/\D/g, "");
  const mensagem = encodeURIComponent(
    `Olá! Poderia avaliar sua experiência com a nossa loja? É rapidinho: ${linkAvaliacao(pv.tokenAvaliacao)}`
  );
  return numero ? `https://wa.me/55${numero}?text=${mensagem}` : `https://wa.me/?text=${mensagem}`;
}

/** Copia o link de avaliação. Devolve se deu certo (navegador sem permissão falha). */
export async function copiarLinkAvaliacao(token: string) {
  try {
    await navigator.clipboard.writeText(linkAvaliacao(token));
    return true;
  } catch {
    return false;
  }
}
