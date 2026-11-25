"use client";

/**
 * Seções da área de Pós-venda.
 *
 * A seção aberta mora na URL (/pos-venda?secao=manutencoes), como na Central
 * de Marketing: o menu é feito de links de verdade, o "voltar" do navegador
 * volta para a seção anterior e dá para mandar o link de uma seção. O
 * /pos-venda puro continua abrindo a Visão geral.
 *
 * Mora aqui, e não no layout.tsx, porque arquivo de layout do Next só pode
 * exportar o próprio layout.
 */
import { useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Flame, LayoutGrid, Star, UserRound, Wrench } from "lucide-react";

export const SECOES_POS_VENDA = [
  {
    id: "visao",
    rotulo: "Visão geral",
    icone: LayoutGrid,
    descricao: "A jornada inteira do cliente depois da venda: o que pede atenção, o funil e o que vem pela frente.",
  },
  {
    id: "instalacoes",
    rotulo: "Instalações",
    icone: Wrench,
    descricao: "Da venda fechada à lareira instalada: agendar, acompanhar e concluir.",
  },
  {
    id: "reclamacoes",
    rotulo: "Reclamações",
    icone: AlertTriangle,
    descricao: "O que o cliente reclamou, há quanto tempo, e o que já foi resolvido.",
  },
  {
    id: "avaliacoes",
    rotulo: "Avaliações",
    icone: Star,
    descricao: "Como os clientes avaliam a loja e para quem ainda falta pedir a avaliação.",
  },
  {
    id: "manutencoes",
    rotulo: "Manutenções",
    icone: Flame,
    descricao: "Limpeza anual da chaminé e revisão: um ano depois da instalação, a loja volta a chamar o cliente.",
  },
  {
    id: "antigos",
    rotulo: "Clientes antigos",
    icone: UserRound,
    descricao: "Quem comprou antes do CRM e foi marcado no WhatsApp: acompanhar e programar a limpeza.",
  },
] as const satisfies ReadonlyArray<{ id: string; rotulo: string; icone: LucideIcon; descricao: string }>;

export type SecaoPosVenda = (typeof SECOES_POS_VENDA)[number]["id"];

const PADRAO: SecaoPosVenda = "visao";

function ehSecao(valor: string | null): valor is SecaoPosVenda {
  return SECOES_POS_VENDA.some((s) => s.id === valor);
}

/** Endereço de uma seção, com parâmetros extras opcionais (?filtro=, ?visao=). */
export function hrefDaSecao(secao: SecaoPosVenda, extra?: Record<string, string>) {
  const params = new URLSearchParams();
  if (secao !== PADRAO) params.set("secao", secao);
  for (const [k, v] of Object.entries(extra ?? {})) params.set(k, v);
  const qs = params.toString();
  return qs ? `/pos-venda?${qs}` : "/pos-venda";
}

export function dadosDaSecao(secao: SecaoPosVenda) {
  return SECOES_POS_VENDA.find((s) => s.id === secao) ?? SECOES_POS_VENDA[0];
}

/**
 * Seção aberta agora, lida da URL. Usa useSearchParams: quem chama precisa
 * estar dentro de um <Suspense> (o layout do pós-venda já embrulha tudo).
 */
export function useSecaoPosVenda(): SecaoPosVenda {
  const secao = useSearchParams().get("secao");
  return ehSecao(secao) ? secao : PADRAO;
}
