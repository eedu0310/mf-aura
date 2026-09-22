"use client";

import { Sparkles } from "lucide-react";
import { RelatóriosAvançados } from "@/components/relatorios/relatorios-avancados";

export default function RelatóriosAvançadosPage() {
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
        <div className="relative mx-auto max-w-5xl">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-aura-gold">
            <Sparkles size={12} />
            Relatórios
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold text-white sm:text-3xl">
            Relatórios Avançados
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Analise suas vendas, compare períodos e gere insights acionáveis.
          </p>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="mx-auto w-full max-w-5xl px-6 pb-24 sm:px-8">
        <RelatóriosAvançados />
      </div>
    </div>
  );
}