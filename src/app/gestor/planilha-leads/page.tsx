"use client";

import { Table2 } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { PlanilhaLeadsDashboard } from "@/components/planilha-leads/planilha-leads-dashboard";
import { PlanilhaLinhasCard } from "@/components/gestor/planilha-linhas-card";

export default function PlanilhaLeadsGestorPage() {
  return (
    <div className="pb-24">
      {/* Cabeçalho claro no lugar da faixa escura; o layout do gestor já dá a
          largura e o respiro da página. */}
      <PageHeader
        titulo="Planilha de Leads — Gestão"
        descricao="Monitore todos os indicadores de leads da equipe"
        icone={Table2}
      />

      {/* Conteúdo */}
      <div className="flex flex-col gap-6">
        <PlanilhaLinhasCard />
        <PlanilhaLeadsDashboard />
      </div>
    </div>
  );
}
