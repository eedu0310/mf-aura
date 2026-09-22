"use client";

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
      <div className="rounded-lg border border-aura-mist bg-white p-4">
        <p className="text-sm text-aura-graphite-soft">Dados indisponíveis</p>
      </div>
    );
  }

  const obterEmoji = (pos: number) => {
    if (pos === 1) return "🥇";
    if (pos === 2) return "🥈";
    if (pos === 3) return "🥉";
    return "📊";
  };

  return (
    <div className="rounded-lg border border-aura-mist bg-white p-4">
      <h3 className="text-sm font-semibold text-aura-graphite mb-3">
        🏆 Ranking
      </h3>
      <div className="space-y-2">
        <div className="flex items-center justify-center gap-2">
          <span className="text-4xl">{obterEmoji(posicao)}</span>
          <div>
            <p className="text-3xl font-bold text-aura-graphite">
              {posicao}º
            </p>
            <p className="text-xs text-aura-graphite-soft">
              de {totalEquipe}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}