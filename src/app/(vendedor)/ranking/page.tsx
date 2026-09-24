"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import { RankingGeral } from "@/components/ranking/ranking-geral";
import { RankingGamificado } from "@/components/ranking/ranking-gamificado";
import { RankingAvancado } from "@/components/ranking/ranking-avancado";
import { AuraInsightCard } from "@/components/aura/aura-insight-card";

type AbaRanking = "grupo" | "gamificado" | "avancado";

export default function RankingPage() {
  const [abaAtiva, setAbaAtiva] = useState<AbaRanking>("grupo");

  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-6 px-4 pb-24 sm:px-6 lg:px-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-semibold text-aura-graphite">
          Ranking
        </h1>
        <p className="text-sm text-aura-graphite-soft">
          Todos os vendedores do grupo na mesma disputa
        </p>
      </div>

      <AuraInsightCard pagina="ranking" />

      {/* Abas */}
      <div className="flex gap-1 border-b border-aura-mist">
        <button
          onClick={() => setAbaAtiva("grupo")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition ${
            abaAtiva === "grupo"
              ? "border-b-2 border-aura-petrol-700 text-aura-petrol-700"
              : "text-aura-graphite-soft hover:text-aura-graphite"
          }`}
        >
          <Trophy size={16} />
          Ranking do grupo
        </button>
        <button
          onClick={() => setAbaAtiva("gamificado")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition ${
            abaAtiva === "gamificado"
              ? "border-b-2 border-aura-petrol-700 text-aura-petrol-700"
              : "text-aura-graphite-soft hover:text-aura-graphite"
          }`}
        >
          <Trophy size={16} />
          Gamificado
        </button>
        <button
          onClick={() => setAbaAtiva("avancado")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition ${
            abaAtiva === "avancado"
              ? "border-b-2 border-aura-petrol-700 text-aura-petrol-700"
              : "text-aura-graphite-soft hover:text-aura-graphite"
          }`}
        >
          <Trophy size={16} />
          Avançado
        </button>
      </div>

      {/* Conteúdo das Abas */}
      {abaAtiva === "grupo" && <RankingGeral />}
      {abaAtiva === "gamificado" && <RankingGamificado />}
      {abaAtiva === "avancado" && <RankingAvancado />}
    </div>
  );
}
