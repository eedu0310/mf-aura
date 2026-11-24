"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import { RankingGeral } from "@/components/ranking/ranking-geral";
import { RankingGamificado } from "@/components/ranking/ranking-gamificado";
import { RankingAvancado } from "@/components/ranking/ranking-avancado";
import { AuraInsightCard } from "@/components/aura/aura-insight-card";
import { PageContainer, PageHeader, Segmentado } from "@/components/ui";

type AbaRanking = "grupo" | "gamificado" | "avancado";

export default function RankingPage() {
  const [abaAtiva, setAbaAtiva] = useState<AbaRanking>("grupo");

  return (
    <PageContainer className="min-w-0 space-y-6">
      <PageHeader
        titulo="Ranking"
        descricao="Todos os vendedores do grupo na mesma disputa"
        icone={Trophy}
        className="mb-0"
      />

      <AuraInsightCard pagina="ranking" />

      {/* Abas */}
      <Segmentado<AbaRanking>
        rotulo="Tipo de ranking"
        valor={abaAtiva}
        aoMudar={setAbaAtiva}
        opcoes={[
          { valor: "grupo", rotulo: "Ranking do grupo" },
          { valor: "gamificado", rotulo: "Gamificado" },
          { valor: "avancado", rotulo: "Avançado" },
        ]}
      />

      {/* Conteúdo das Abas */}
      {abaAtiva === "grupo" && <RankingGeral />}
      {abaAtiva === "gamificado" && <RankingGamificado />}
      {abaAtiva === "avancado" && <RankingAvancado />}
    </PageContainer>
  );
}
