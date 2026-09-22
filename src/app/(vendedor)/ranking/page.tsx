"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import { RankingGamificado } from "@/components/ranking/ranking-gamificado";
import { RankingAvancado } from "@/components/ranking/ranking-avancado";

type AbaRanking = "gamificado" | "avancado";

export default function RankingPage() {
  const [abaAtiva, setAbaAtiva] = useState<AbaRanking>("gamificado");

  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-6 px-4 pb-24 sm:px-6 lg:px-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-semibold text-aura-graphite">
          Ranking
        </h1>
        <p className="text-sm text-aura-graphite-soft">
          Acompanhe seu desempenho
        </p>
      </div>

      {/* Abas */}
      <div className="flex gap-1 border-b border-aura-mist">
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
      {abaAtiva === "gamificado" && <RankingGamificado />}
      {abaAtiva === "avancado" && <RankingAvancado />}
    </div>
  );
}
