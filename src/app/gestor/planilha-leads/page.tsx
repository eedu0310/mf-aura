"use client";

import { PlanilhaLeadsDashboard } from "@/components/planilha-leads/planilha-leads-dashboard";
import { PlanilhaLinhasCard } from "@/components/gestor/planilha-linhas-card";

export default function PlanilhaLeadsGestorPage() {
  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-aura-navy-950 to-aura-navy-900 px-6 pb-10 pt-8 sm:px-8">
        <div className="relative mx-auto max-w-7xl">
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
            📊 Planilha de Leads — Gestão
          </h1>
          <p className="mt-1 text-sm text-white/70">
            Monitore todos os indicadores de leads da equipe
          </p>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="mx-auto w-full max-w-7xl space-y-6 px-6 sm:px-8">
        <PlanilhaLinhasCard />
        <PlanilhaLeadsDashboard />
      </div>
    </div>
  );
}