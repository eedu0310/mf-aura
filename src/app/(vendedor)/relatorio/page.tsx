"use client";

import { RelatorioVendedor } from "@/components/vendedor/relatorio-vendedor";

export default function RelatorioPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-aura-graphite">
          Meu Relatório
        </h1>
        <p className="text-sm text-aura-graphite-soft">
          Seu desempenho consolidado
        </p>
      </div>

      <RelatorioVendedor />
    </div>
  );
}