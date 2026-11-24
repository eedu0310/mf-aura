"use client";

import { Trophy } from "lucide-react";

interface RankingMiniCardProps {
  posicao: number | null;
  totalEquipe: number;
}

export function RankingMiniCard({
  posicao,
  totalEquipe,
}: RankingMiniCardProps) {
  if (!posicao) {
    return (
      <div className="aura-card p-4">
        <div className="flex items-center gap-1.5">
          <Trophy size={13} className="text-aura-graphite-soft" />
          <h3 className="aura-rotulo">Ranking</h3>
        </div>
        <p className="mt-2 text-sm text-aura-graphite-soft">Dados indisponíveis</p>
      </div>
    );
  }

  // Pódio em ouro, prata e bronze; do 4º em diante, neutro.
  const corDaPosicao = (pos: number) => {
    if (pos === 1) return "bg-aura-gold/15 text-aura-gold-700";
    if (pos === 2) return "bg-aura-sunken text-aura-graphite";
    if (pos === 3) return "bg-aura-warning/12 text-aura-warning";
    return "bg-aura-sunken text-aura-graphite-soft";
  };

  return (
    <div className="aura-card p-4">
      <div className="flex items-center gap-1.5">
        <Trophy size={13} className="text-aura-gold-700" />
        <h3 className="aura-rotulo">Ranking</h3>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div>
          <p className="font-display text-3xl font-semibold tabular-nums text-aura-graphite">
            {posicao}º
          </p>
          <p className="text-xs text-aura-graphite-soft">
            de {totalEquipe}
          </p>
        </div>
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${corDaPosicao(posicao)}`}>
          <Trophy size={20} />
        </span>
      </div>
    </div>
  );
}