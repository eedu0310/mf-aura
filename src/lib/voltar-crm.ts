"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * "Voltar" das áreas de trabalho (Pós-venda, Marketing, Painel do Gestor).
 *
 * Essas áreas abrem sozinhas, sem o menu do CRM. O botão Voltar precisa levar
 * para onde a pessoa estava antes de entrar nelas (o Meu Dia, a ficha de um
 * cliente, o pipeline...), e não sempre para o Meu Dia. O router.back() não
 * serve: dentro da área a pessoa troca de seção várias vezes, e o "voltar" do
 * navegador iria só para a seção anterior.
 *
 * Então o layout do CRM guarda a última página dele (useLembrarPaginaDoCrm) e
 * o botão lê de lá. Fica no sessionStorage: vale para esta aba do navegador.
 */
const CHAVE = "aura:ultima-pagina-crm";
const PADRAO = "/meu-dia";

export function useLembrarPaginaDoCrm() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAVE, pathname + window.location.search);
    } catch {
      /* sem armazenamento: o Voltar cai no Meu Dia */
    }
  }, [pathname]);
}

/** Para onde o Voltar leva. Só aceita caminho interno ("/..."). */
export function paginaDeVolta(): string {
  try {
    const salva = sessionStorage.getItem(CHAVE);
    if (salva && salva.startsWith("/") && !salva.startsWith("//")) return salva;
  } catch {
    /* idem */
  }
  return PADRAO;
}
