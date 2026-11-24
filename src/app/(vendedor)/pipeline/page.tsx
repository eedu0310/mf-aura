"use client";

import { Kanban } from "lucide-react";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { AuraInsightCard } from "@/components/aura/aura-insight-card";
import { PageContainer, PageHeader } from "@/components/ui";

export default function PipelinePage() {
  return (
    <PageContainer largura="total">
      <PageHeader
        titulo="Pipeline de Vendas"
        descricao="Acompanhe todas as suas oportunidades em cada etapa da negociação."
        icone={Kanban}
      />

      <div className="space-y-6">
        {/* Supervisora AURA */}
        <AuraInsightCard pagina="pipeline" />

        {/* Conteúdo */}
        <PipelineBoard />
      </div>
    </PageContainer>
  );
}
