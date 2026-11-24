"use client";

import { Sparkles } from "lucide-react";
import { RelatóriosAvançados } from "@/components/relatorios/relatorios-avancados";
import { PageContainer, PageHeader } from "@/components/ui";

export default function RelatóriosAvançadosPage() {
  return (
    <PageContainer largura="normal">
      <PageHeader
        rotulo="Relatórios"
        titulo="Relatórios Avançados"
        descricao="Analise suas vendas, compare períodos e gere insights acionáveis."
        icone={Sparkles}
      />
      <RelatóriosAvançados />
    </PageContainer>
  );
}
