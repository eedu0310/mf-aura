/**
 * O pedido de avaliação, num lugar só: o modal do pós-venda e a seção
 * Avaliações usam o mesmo link e a mesma mensagem de WhatsApp.
 *
 * O link é a página pública /avaliar/<token>; o token já vem em cada
 * pós-venda. O WhatsApp é um link wa.me comum: só abre a conversa com o texto
 * pronto, quem manda é a pessoa.
 *
 * O ENDEREÇO é o da loja do cliente (27/11/2026: "precisamos mascarar o
 * domínio crm.mflaser"): avaliar.aegaquecimento.com.br/avaliar/<token>, e não
 * crm.mflaser.com.br — o cliente da A&G via o nome da fábrica. Os endereços
 * vêm de config_avaliacao.dominio_link (migração 123); loja sem endereço no ar
 * ainda usa o do próprio AURA.
 */
import type { PosVenda } from "@/lib/supabase/pos-venda";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const dominioDaLoja = new Map<string, string>();
let carregando: Promise<void> | null = null;

/** Lê os endereços das lojas uma vez por sessão. */
function carregarDominios(): Promise<void> {
  if (carregando) return carregando;
  carregando = (async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb) return;
    const { data } = await sb.from("config_avaliacao").select("empresa, dominio_link");
    for (const c of (data ?? []) as { empresa: string; dominio_link: string | null }[]) {
      const d = (c.dominio_link ?? "").trim().toLowerCase();
      if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) dominioDaLoja.set(c.empresa, d);
    }
  })().catch(() => {
    carregando = null;
  });
  return carregando;
}
// Já no carregamento da tela: o "Enviar por WhatsApp" abre a janela no clique,
// sem tempo de esperar o banco.
if (typeof window !== "undefined") void carregarDominios();

export function linkAvaliacao(token: string, empresa?: string | null) {
  const dominio = empresa ? dominioDaLoja.get(empresa) : undefined;
  return `${dominio ? `https://${dominio}` : window.location.origin}/avaliar/${token}`;
}

export function linkWhatsAppAvaliacao(pv: Pick<PosVenda, "telefone" | "tokenAvaliacao" | "empresa">) {
  const numero = pv.telefone?.replace(/\D/g, "");
  const mensagem = encodeURIComponent(
    `Olá! Poderia avaliar sua experiência com a nossa loja? É rapidinho: ${linkAvaliacao(pv.tokenAvaliacao, pv.empresa)}`
  );
  return numero ? `https://wa.me/55${numero}?text=${mensagem}` : `https://wa.me/?text=${mensagem}`;
}

/** Copia o link de avaliação. Devolve se deu certo (navegador sem permissão falha). */
export async function copiarLinkAvaliacao(token: string, empresa?: string | null) {
  try {
    await carregarDominios();
    await navigator.clipboard.writeText(linkAvaliacao(token, empresa));
    return true;
  } catch {
    return false;
  }
}
