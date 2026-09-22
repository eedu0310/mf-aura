"use client";

import type { DnaScoreDetalhe } from "@/lib/compute-dna-score";

interface DnaScoreCardProps {
  score: number;
  nivelAtual: string;
  detalhes?: DnaScoreDetalhe[];
  recomendacao?: string;
}

export function DnaScoreCard({ score, nivelAtual, detalhes = [], recomendacao }: DnaScoreCardProps) {
  const obterCor = (valor: number) => {
    if (valor >= 80) return "text-green-600";
    if (valor >= 60) return "text-yellow-600";
    if (valor >= 40) return "text-orange-600";
    return "text-red-600";
  };

  return (
    <div className="rounded-lg border border-aura-mist bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-aura-graphite">DNA Comercial</h3>
      <div className="space-y-3">
        <div className="flex items-center justify-center">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-aura-bg" />
            <span className={`text-3xl font-bold ${obterCor(score)}`}>{score}</span>
          </div>
        </div>
        <div className="text-center">
          <p className="text-xs text-aura-graphite-soft">Nível Atual</p>
          <p className="font-medium text-aura-graphite">{nivelAtual}</p>
        </div>
        {recomendacao && <p className="rounded-xl bg-aura-bg p-2.5 text-xs leading-relaxed text-aura-graphite-soft">{recomendacao}</p>}
        {detalhes.length > 0 && (
          <div className="space-y-2 border-t border-aura-mist pt-3">
            {detalhes.map((detalhe) => (
              <div key={detalhe.label}>
                <div className="flex items-center justify-between gap-2 text-[0.68rem]">
                  <span className="text-aura-graphite">{detalhe.label}</span>
                  <span className="font-data text-aura-graphite-soft">{detalhe.percentual}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-aura-bg">
                  <div className="h-full rounded-full bg-aura-petrol-600" style={{ width: `${detalhe.percentual}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
