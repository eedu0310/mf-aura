"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface RankingItem {
  posicao: number;
  nome: string;
  faturamento: number;
  meta: number;
  percentual: number;
  tendencia: "up" | "down" | "stable";
  mudancaPosicao: number;
}

export function DashboardRanking({ dados }: { dados: RankingItem[] }) {
  const getMedal = (pos: number) => {
    switch (pos) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return `#${pos}`;
    }
  };

  const getTrendIcon = (tendencia: string) => {
    switch (tendencia) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-aura-success" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-aura-danger" />;
      default:
        return <Minus className="h-4 w-4 text-aura-graphite-soft" />;
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg font-semibold text-aura-graphite">
        🏆 Ranking Dinâmico
      </h3>

      <div className="space-y-2">
        {dados.map((item) => (
          <div
            key={item.nome}
            className="rounded-xl border border-aura-mist bg-white p-4 hover:border-aura-petrol-500 transition"
          >
            <div className="flex items-center justify-between gap-4">
              {/* Posição e Nome */}
              <div className="flex items-center gap-3 flex-1">
                <span className="text-xl font-bold text-aura-graphite min-w-12">
                  {getMedal(item.posicao)}
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-aura-graphite">{item.nome}</p>
                  <p className="text-xs text-aura-graphite-soft">
                    {item.percentual.toFixed(1)}% da meta
                  </p>
                </div>
              </div>

              {/* Faturamento */}
              <div className="text-right min-w-32">
                <p className="font-display text-lg font-bold text-aura-petrol-600">
                  R$ {(item.faturamento / 1000).toFixed(1)}k
                </p>
                <p className="text-xs text-aura-graphite-soft">
                  Meta: R$ {(item.meta / 1000).toFixed(1)}k
                </p>
              </div>

              {/* Barra de Progresso */}
              <div className="hidden sm:flex items-center gap-2 min-w-48">
                <div className="flex-1 h-2 rounded-full bg-aura-mist overflow-hidden">
                  <div
                    className="h-full bg-aura-petrol-600 transition"
                    style={{ width: `${Math.min(item.percentual, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-aura-graphite w-10 text-right">
                  {Math.min(item.percentual, 100).toFixed(0)}%
                </span>
              </div>

              {/* Tendência */}
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  {getTrendIcon(item.tendencia)}
                  <span className="text-xs font-semibold text-aura-graphite">
                    {item.mudancaPosicao > 0
                      ? `↑ ${item.mudancaPosicao}`
                      : item.mudancaPosicao < 0
                        ? `↓ ${Math.abs(item.mudancaPosicao)}`
                        : "→"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}