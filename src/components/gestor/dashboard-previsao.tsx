"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface PrevisaoDados {
  mes: string;
  confirmado: number;
  previsto: number;
  meta: number;
}

export function DashboardPrevisao({ dados }: { dados: PrevisaoDados[] }) {
  const ultimoMes = dados[dados.length - 1];
  const gap = Math.max(0, ultimoMes.meta - (ultimoMes.confirmado + ultimoMes.previsto));

  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg font-semibold text-aura-graphite">
        💰 Previsão de Faturamento
      </h3>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Confirmado */}
        <div className="rounded-2xl border border-aura-mist bg-white p-4">
          <p className="text-sm text-aura-graphite-soft">Faturamento Confirmado</p>
          <p className="mt-2 font-display text-xl font-bold text-aura-success">
            R$ {(ultimoMes.confirmado / 1000).toFixed(1)}k
          </p>
          <p className="mt-1 text-xs text-aura-graphite-soft">
            {((ultimoMes.confirmado / ultimoMes.meta) * 100).toFixed(0)}% da meta
          </p>
        </div>

        {/* Previsto */}
        <div className="rounded-2xl border border-aura-mist bg-white p-4">
          <p className="text-sm text-aura-graphite-soft">Faturamento Previsto</p>
          <p className="mt-2 font-display text-xl font-bold text-aura-info">
            R$ {(ultimoMes.previsto / 1000).toFixed(1)}k
          </p>
          <p className="mt-1 text-xs text-aura-graphite-soft">
            Propostas em análise
          </p>
        </div>

        {/* Gap */}
        <div className="rounded-2xl border border-aura-mist bg-white p-4">
          <p className="text-sm text-aura-graphite-soft">Gap até a Meta</p>
          <p className={`mt-2 font-display text-xl font-bold ${
            gap > 0 ? "text-aura-warning" : "text-aura-success"
          }`}>
            R$ {(gap / 1000).toFixed(1)}k
          </p>
          <p className="mt-1 text-xs text-aura-graphite-soft">
            {gap > 0 ? "Falta atingir" : "Acima da meta"}
          </p>
        </div>
      </div>

      {/* Gráfico */}
      <div className="rounded-2xl border border-aura-mist bg-white p-5">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={dados}>
            <defs>
              <linearGradient id="colorConfirmado" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#27ae60" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#27ae60" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorPrevisto" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3498db" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3498db" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorMeta" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#95a5a6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#95a5a6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8f0f5" />
            <XAxis dataKey="mes" stroke="#8b92a1" />
            <YAxis stroke="#8b92a1" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e8f0f5",
                borderRadius: "8px",
              }}
            />
            <Area
              type="monotone"
              dataKey="confirmado"
              stroke="#27ae60"
              fillOpacity={1}
              fill="url(#colorConfirmado)"
              name="Confirmado"
            />
            <Area
              type="monotone"
              dataKey="previsto"
              stroke="#3498db"
              fillOpacity={1}
              fill="url(#colorPrevisto)"
              name="Previsto"
            />
            <Area
              type="monotone"
              dataKey="meta"
              stroke="#95a5a6"
              fillOpacity={1}
              fill="url(#colorMeta)"
              name="Meta"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}