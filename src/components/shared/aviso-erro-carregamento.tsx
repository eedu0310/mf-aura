"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";

/**
 * Faixa que aparece quando a leitura do banco falhou.
 *
 * Sem ela, uma falha (RLS, rede, sessão vencida) virava lista vazia — e o
 * vendedor via "nenhum cliente" sem saber que era erro, não carteira vazia.
 */
export function AvisoErroCarregamento() {
  const { erroCarregamento, recarregar } = useAppData();
  if (!erroCarregamento) return null;

  return (
    <div
      role="alert"
      className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:mx-6"
    >
      <AlertTriangle size={18} className="shrink-0" aria-hidden />
      <p className="flex-1">
        {erroCarregamento} Os números desta tela podem estar incompletos.
      </p>
      <button
        type="button"
        onClick={recarregar}
        className="flex items-center gap-1.5 rounded-full border border-amber-400 px-3 py-1 text-xs font-medium hover:bg-amber-100"
      >
        <RefreshCw size={13} aria-hidden />
        Tentar de novo
      </button>
    </div>
  );
}
