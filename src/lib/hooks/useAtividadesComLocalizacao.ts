"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAppData } from "@/lib/app-data-context";
import type { Atividade } from "@/lib/types";

export interface AtividadeComLocalizacao {
  id: string;
  titulo: string;
  tipo: string;
  contexto: string;
  observacao?: string;
  relacionamento_id?: string;
  created_at: string;
  empresa: string;
  owner_id: string;
  latitude?: number;
  longitude?: number;
  endereco?: string;
}

function adaptarAtividade(atividade: Atividade): AtividadeComLocalizacao {
  return {
    id: atividade.id,
    titulo: atividade.titulo,
    tipo: atividade.tipo,
    contexto: atividade.contexto,
    observacao: atividade.anotacoes,
    relacionamento_id: atividade.relacionamentoId,
    created_at: atividade.criadoEm,
    empresa: atividade.empresa ?? "",
    owner_id: atividade.ownerId ?? atividade.vendedorId,
    latitude: atividade.latitude,
    longitude: atividade.longitude,
    endereco: atividade.endereco,
  };
}

export function useAtividadesComLocalizacao() {
  const { atividades: atividadesOriginais } = useAppData();
  const [atividades, setAtividades] = useState<AtividadeComLocalizacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  useEffect(() => {
    let montado = true;

    async function buscarAtividades() {
      if (!supabase) {
        if (montado) {
          setAtividades((atividadesOriginais || []).map(adaptarAtividade));
          setCarregando(false);
        }
        return;
      }

      setCarregando(true);

      try {
        const { data, error } = await supabase
          .from("atividades")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Erro ao buscar atividades:", error);
          if (montado) {
            setAtividades((atividadesOriginais || []).map(adaptarAtividade));
          }
          return;
        }

        if (montado) {
          setAtividades((data || []) as AtividadeComLocalizacao[]);
        }
      } catch (erro) {
        console.error("Erro ao buscar atividades:", erro);
        if (montado) {
          setAtividades((atividadesOriginais || []).map(adaptarAtividade));
        }
      } finally {
        if (montado) setCarregando(false);
      }
    }

    void buscarAtividades();

    const subscription = supabase
      ?.channel("atividades-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "atividades" },
        (payload) => {
          if (!montado) return;

          setAtividades((prev) => {
            if (payload.eventType === "INSERT") {
              return [payload.new as AtividadeComLocalizacao, ...prev];
            }

            if (payload.eventType === "UPDATE") {
              return prev.map((atividade) =>
                atividade.id === payload.new.id
                  ? (payload.new as AtividadeComLocalizacao)
                  : atividade,
              );
            }

            if (payload.eventType === "DELETE") {
              return prev.filter(
                (atividade) => atividade.id !== payload.old.id,
              );
            }

            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      montado = false;
      if (supabase && subscription) {
        void supabase.removeChannel(subscription);
      }
    };
  }, [atividadesOriginais, supabase]);

  return { atividades, carregando };
}
