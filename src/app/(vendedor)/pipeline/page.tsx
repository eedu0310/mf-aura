"use client";

import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { AuraInsightCard } from "@/components/aura/aura-insight-card";

export default function PipelinePage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-aura-navy-950 px-6 pb-10 pt-8 sm:px-8">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-aura-gold/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-aura-petrol-500/10 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-7xl">
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
            Pipeline de Vendas
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Acompanhe todas as suas oportunidades em cada etapa da negociação.
          </p>
        </div>
      </div>

      {/* Supervisora AURA */}
      <div className="mx-auto w-full max-w-7xl px-6 sm:px-8">
        <AuraInsightCard pagina="pipeline" />
      </div>

      {/* Conteúdo */}
      <div className="mx-auto w-full max-w-7xl px-6 pb-24 sm:px-8">
        <PipelineBoard />
      </div>
    </div>
  );
}
