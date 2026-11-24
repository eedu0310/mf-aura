"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { RelatorioVisual } from "@/components/aura/relatorio-visual";
import { RelatorioSemanalView } from "@/components/relatorio-semanal/relatorio-semanal-view";
import { PageContainer, PageHeader, Segmentado } from "@/components/ui";

type Aba = "periodo" | "semanal";

export default function RelatorioPage() {
  const [aba, setAba] = useState<Aba>("periodo");

  return (
    <PageContainer className="space-y-6">
      {/* No papel quem dá o título é o cabeçalho de impressão, que também traz
          o período e os filtros. Dois títulos seguidos só gastam a primeira
          dobra da folha. */}
      <PageHeader
        className="mb-0 print:hidden"
        titulo="Meu Relatório"
        descricao="Seu desempenho em números e gráficos"
        icone={BarChart3}
      />

      {/* As duas leituras do mesmo trabalho: o período que a pessoa escolhe, e
          o fechamento da semana que a AURA entrega todo sábado com a avaliação
          do atendimento. Abas em vez de uma página só porque são documentos
          diferentes — e cada um é impresso separado. */}
      <Segmentado<Aba>
        className="print:hidden"
        rotulo="Tipo de relatório"
        opcoes={[
          { valor: "periodo", rotulo: "Relatório do período" },
          { valor: "semanal", rotulo: "Fechamento da semana" },
        ]}
        valor={aba}
        aoMudar={setAba}
      />

      {aba === "periodo" ? <RelatorioVisual /> : <RelatorioSemanalView />}
    </PageContainer>
  );
}
