"use client";

/**
 * Abas da área de Marketing e o contexto que o layout compartilha com a página.
 * Moram aqui, e não no layout.tsx, porque arquivo de layout do Next só pode
 * exportar o próprio layout: o build com webpack recusa qualquer outro export.
 */
import { createContext, useContext } from "react";
import { LayoutGrid, UserPlus, Megaphone, Calendar, Table2 } from "lucide-react";

export const ABAS_MARKETING = [
  { id: "visao-geral", label: "Visão Geral", icon: LayoutGrid },
  { id: "leads", label: "Leads", icon: UserPlus },
  { id: "campanhas", label: "Campanhas", icon: Megaphone },
  { id: "postagens", label: "Postagens", icon: Calendar },
  { id: "indicadores", label: "Indicadores", icon: Table2 },
] as const;

export type AbaMarketing = (typeof ABAS_MARKETING)[number]["id"];

export interface AbaMarketingContextValue {
  aba: AbaMarketing;
  setAba: (aba: AbaMarketing) => void;
}

export const AbaMarketingContext = createContext<AbaMarketingContextValue | null>(null);

export function useAbaMarketing() {
  const ctx = useContext(AbaMarketingContext);
  if (!ctx) throw new Error("useAbaMarketing precisa estar dentro do MarketingLayout");
  return ctx;
}
