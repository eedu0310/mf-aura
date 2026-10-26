"use client";

import { useEffect, useState } from "react";
import { useAppData } from "@/lib/app-data-context";
import { computeMissoesDoDia } from "@/lib/compute-missoes";
import type { TarefaPendente } from "@/lib/compute-pending-tasks";

/**
 * Aviso do sininho para as missões do dia.
 *
 * O interruptor "Missões do dia" das Configurações só mostrava o quadro no
 * Meu Dia; o texto dele prometia avisar e nada avisava. Ligado, agora o
 * sininho mostra quantas missões de hoje ainda faltam, até completar todas.
 */
export function useAvisoMissoes(): TarefaPendente | null {
  const { relacionamentos, oportunidades, atividades } = useAppData();
  const [ligado, setLigado] = useState(false);
  useEffect(() => {
    try {
      setLigado(localStorage.getItem("aura:missoes") === "true");
    } catch {
      /* navegador sem armazenamento: desligado */
    }
  }, []);
  if (!ligado) return null;
  const missoes = computeMissoesDoDia({ relacionamentos, oportunidades, atividades });
  const faltam = missoes.filter((m) => !m.concluida);
  if (!faltam.length) return null;
  return {
    id: "missoes-do-dia",
    titulo: `Missões do dia · faltam ${faltam.length} de ${missoes.length}`,
    quando: faltam.map((m) => m.titulo).join(" · "),
    urgente: false,
    href: "/meu-dia",
  };
}
