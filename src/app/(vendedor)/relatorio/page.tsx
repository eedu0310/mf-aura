"use client";

import { RelatorioVisual } from "@/components/aura/relatorio-visual";

export default function RelatorioPage() {
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

      <RelatorioVisual />
    </div>
  );
}
