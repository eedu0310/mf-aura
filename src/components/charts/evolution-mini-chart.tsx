"use client";

import { AreaChart, Area, XAxis, ResponsiveContainer } from "recharts";

export function EvolutionMiniChart({ data }: { data: { dia: string; valor: number }[] }) {
  return (
    <div className="mt-2 h-28 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="evolucaoMeta" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--aura-petrol-500)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--aura-petrol-500)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="dia"
            tick={{ fontSize: 10, fill: "var(--aura-graphite-soft)" }}
            axisLine={false}
            tickLine={false}
          />
          <Area
            type="monotone"
            dataKey="valor"
            stroke="var(--aura-petrol-600)"
            strokeWidth={2}
            fill="url(#evolucaoMeta)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
