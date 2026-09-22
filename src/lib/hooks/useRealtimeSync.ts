"use client";

import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function useRealtimeSync() {
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    if (!supabase) return;

    // Sincronizar todas as tabelas em tempo real
    const setupRealtime = async () => {
      const tables = [
        "vendas",
        "oportunidades",
        "atividades",
        "relacionamentos",
        "compromissos",
        "planilha_leads_indicadores",
        "profiles",
      ];

      tables.forEach((table) => {
        const channel = supabase
          .channel(`${table}-changes`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table },
            (payload) => {
              // Disparar evento customizado
              window.dispatchEvent(
                new CustomEvent("supabase-change", {
                  detail: { table, payload },
                })
              );

              // Log para debug
              console.log(`🔄 ${table} atualizado:`, payload);
            }
          )
          .subscribe();
      });
    };

    setupRealtime();

    return () => {
      supabase.removeAllChannels();
    };
  }, [supabase]);
}