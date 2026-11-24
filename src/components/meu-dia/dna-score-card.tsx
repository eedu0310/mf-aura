"use client";

import { Dna } from "lucide-react";
import type { DnaScoreDetalhe } from "@/lib/compute-dna-score";

interface DnaScoreCardProps {
  score: number;
  nivelAtual: string;
  detalhes?: DnaScoreDetalhe[];
  recomendacao?: string;
}

export function DnaScoreCard({ score, nivelAtual, detalhes = [], recomendacao }: DnaScoreCardProps) {
  const obterCor = (valor: number) => {
    if (valor >= 80) return "text-aura-success";
    if (valor >= 60) return "text-aura-gold-700";
    if (valor >= 40) return "text-aura-warning";
    return "text-aura-danger";
  };

  return (
    <div className="aura-card p-4">
      <div className="flex items-center gap-1.5">
        <Dna size={13} className="text-aura-petrol-600" />
        <h3 className="aura-rotulo">DNA Comercial</h3>
      </div>
      <div className="mt-2 space-y-3">
        <div className="flex items-end justify-between gap-2">
          <span className={`font-display text-3xl font-semibold tabular-nums ${obterCor(score)}`}>{score}</span>
          <div className="text-right">
            <p className="text-[0.6875rem] text-aura-graphite-soft">Nível Atual</p>
            <p className="text-sm font-medium text-aura-graphite">{nivelAtual}</p>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-aura-sunken">
          <div className="h-full rounded-full bg-aura-petrol-500" style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
        </div>
        {recomendacao && <p className="rounded-lg bg-aura-sunken p-2.5 text-xs leading-relaxed text-aura-graphite-soft">{recomendacao}</p>}
        {detalhes.length > 0 && (
          <div className="space-y-2 border-t border-aura-mist pt-3">
            {detalhes.map((detalhe) => (
              <div key={detalhe.label}>
                <div className="flex items-center justify-between gap-2 text-[0.68rem]">
                  <span className="text-aura-graphite">{detalhe.label}</span>
                  <span className="font-data text-aura-graphite-soft">{detalhe.percentual}</span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-aura-sunken">
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
