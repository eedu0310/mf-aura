"use client";

/**
 * Seções da Central de Marketing.
 *
 * A seção aberta mora na URL (/marketing?secao=leads), e não num estado do
 * layout: assim o menu lateral é feito de links de verdade, o "voltar" do
 * navegador volta para a seção anterior, dá para mandar o link de uma seção
 * para alguém e o menu continua funcionando dentro de /marketing/planilha-leads.
 * O endereço antigo (/marketing, sem nada) continua abrindo a Visão geral.
 *
 * Moram aqui, e não no layout.tsx, porque arquivo de layout do Next só pode
 * exportar o próprio layout: o build com webpack recusa qualquer outro export.
 */
import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, UserPlus, Megaphone, Calendar, Table2 } from "lucide-react";

export const ABAS_MARKETING = [
  {
    id: "visao-geral",
    label: "Visão geral",
    icon: LayoutGrid,
    descricao: "O resumo do marketing: números, de onde vêm os leads e o que pede atenção.",
  },
  {
    id: "leads",
    label: "Leads",
    icon: UserPlus,
    descricao: "Todos os contatos que chegaram, com a origem e em que pé está cada um.",
  },
  {
    id: "campanhas",
    label: "Campanhas",
    icon: Megaphone,
    descricao: "Campanhas e anúncios: situação, leads trazidos e vendas fechadas.",
  },
  {
    id: "postagens",
    label: "Postagens",
    icon: Calendar,
    descricao: "Calendário de postagens: planejar, aprovar e marcar o que já foi publicado.",
  },
  {
    id: "indicadores",
    label: "Indicadores",
    icon: Table2,
    descricao: "Indicadores semanais da equipe no mês, somados de todos os vendedores.",
  },
] as const;

export type AbaMarketing = (typeof ABAS_MARKETING)[number]["id"];

const ABA_PADRAO: AbaMarketing = "visao-geral";

function ehAba(valor: string | null): valor is AbaMarketing {
  return ABAS_MARKETING.some((a) => a.id === valor);
}

/** Endereço de cada seção. A Visão geral fica no /marketing puro, como sempre foi. */
export function hrefDaAba(aba: AbaMarketing) {
  return aba === ABA_PADRAO ? "/marketing" : `/marketing?secao=${aba}`;
}

export function dadosDaAba(aba: AbaMarketing) {
  return ABAS_MARKETING.find((a) => a.id === aba) ?? ABAS_MARKETING[0];
}

/**
 * Seção aberta agora, lida da URL. A planilha por vendedor é uma página à
 * parte, mas faz parte de Indicadores: o menu acende "Indicadores" nela, para a
 * pessoa saber onde está.
 *
 * Usa useSearchParams, então quem chama precisa estar dentro de um <Suspense>
 * (o layout do marketing já embrulha tudo).
 */
export function useAbaMarketing() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const secao = params.get("secao");
  const aba: AbaMarketing = pathname?.startsWith("/marketing/planilha-leads")
    ? "indicadores"
    : ehAba(secao)
      ? secao
      : ABA_PADRAO;

  const setAba = useCallback((nova: AbaMarketing) => router.push(hrefDaAba(nova)), [router]);

  return { aba, setAba };
}
