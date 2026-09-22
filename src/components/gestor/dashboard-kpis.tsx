"use client";

import { TrendingUp, TrendingDown } from "lucide-react";

interface KPIData {
  ticketMedio: number;
  taxaConversao: number;
  cicloDias: number;
  evolucaoMes: number;
}

export function DashboardKPIs({ dados }: { dados: KPIData }) {
  const tendencia = dados.evolucaoMes >= 0 ? "up" : "down";

  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg font-semibold text-aura-graphite">
        KPIs Essenciais
      </h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Ticket Médio */}
        <div className="rounded-2xl border border-aura-mist bg-white p-5">
          <p className="text-sm text-aura-graphite-soft">Ticket Médio</p>
          <p className="mt-2 font-display text-2xl font-bold text-aura-graphite">
            R$ {(dados.ticketMedio / 1000).toFixed(1)}k
          </p>
          <p className="mt-1 text-xs text-aura-graphite-soft">
            Valor médio por venda
          </p>
        </div>

        {/* Taxa de Conversão */}
        <div className="rounded-2xl border border-aura-mist bg-white p-5">
          <p className="text-sm text-aura-graphite-soft">Taxa de Conversão</p>
          <p className="mt-2 font-display text-2xl font-bold text-aura-petrol-600">
            {dados.taxaConversao.toFixed(1)}%
          </p>
          <p className="mt-1 text-xs text-aura-graphite-soft">
            Leads → Vendas
          </p>
        </div>

        {/* Ciclo de Vendas */}
        <div className="rounded-2xl border border-aura-mist bg-white p-5">
          <p className="text-sm text-aura-graphite-soft">Ciclo de Vendas</p>
          <p className="mt-2 font-display text-2xl font-bold text-aura-graphite">
            {dados.cicloDias}d
          </p>
          <p className="mt-1 text-xs text-aura-graphite-soft">
            Dias para fechar
          </p>
        </div>

        {/* Evolução */}
        <div className="rounded-2xl border border-aura-mist bg-white p-5">
          <p className="text-sm text-aura-graphite-soft">Evolução vs Mês</p>
          <div className="mt-2 flex items-center gap-2">
            <p className={`font-display text-2xl font-bold ${
              tendencia === "up" ? "text-aura-success" : "text-aura-danger"
            }`}>
              {Math.abs(dados.evolucaoMes).toFixed(1)}%
            </p>
            {tendencia === "up" ? (
              <TrendingUp className="h-6 w-6 text-aura-success" />
            ) : (
              <TrendingDown className="h-6 w-6 text-aura-danger" />
            )}
          </div>
          <p className="mt-1 text-xs text-aura-graphite-soft">
            Crescimento/Queda
          </p>
        </div>
      </div>
    </div>
  );
}