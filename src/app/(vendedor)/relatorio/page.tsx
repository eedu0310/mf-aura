"use client";

import { useState } from "react";
import { RelatorioVisual } from "@/components/aura/relatorio-visual";
import { RelatorioSemanalView } from "@/components/relatorio-semanal/relatorio-semanal-view";

type Aba = "periodo" | "semanal";

export default function RelatorioPage() {
  const [aba, setAba] = useState<Aba>("periodo");

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 pb-24 pt-4 sm:px-6 lg:px-8">
      {/* No papel quem dá o título é o cabeçalho de impressão, que também traz
          o período e os filtros. Dois títulos seguidos só gastam a primeira
          dobra da folha. */}
      <div className="print:hidden">
        <h1 className="font-display text-2xl font-semibold text-aura-graphite">
          Meu Relatório
        </h1>
        <p className="text-sm text-aura-graphite-soft">
          Seu desempenho em números e gráficos
        </p>
      </div>

      {/* As duas leituras do mesmo trabalho: o período que a pessoa escolhe, e
          o fechamento da semana que a AURA entrega todo sábado com a avaliação
          do atendimento. Abas em vez de uma página só porque são documentos
          diferentes — e cada um é impresso separado. */}
      <div className="flex rounded-full border border-aura-mist bg-white p-1 print:hidden" role="tablist">
        {(
          [
            ["periodo", "Relatório do período"],
            ["semanal", "Fechamento da semana"],
          ] as const
        ).map(([valor, rotulo]) => (
          <button
            key={valor}
            type="button"
            role="tab"
            aria-selected={aba === valor}
            onClick={() => setAba(valor)}
            className={`rounded-full px-4 py-1.5 text-sm transition ${
              aba === valor
                ? "bg-aura-petrol-700 font-medium text-white"
                : "text-aura-graphite hover:bg-aura-bg"
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {aba === "periodo" ? <RelatorioVisual /> : <RelatorioSemanalView />}
    </div>
  );
}
