"use client";

import { BarChart, Bar, ResponsiveContainer, Cell } from "recharts";

export function MiniBarChart({ data }: { data: number[] }) {
  const barras = data.map((valor, i) => ({ i, valor }));
  const ultimo = data.length - 1;

  return (
    <div className="h-12 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={barras} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
          <Bar dataKey="valor" radius={[3, 3, 0, 0]}>
            {barras.map((entrada) => (
              <Cell
                key={entrada.i}
                fill={entrada.i === ultimo ? "var(--aura-petrol-700)" : "var(--aura-mist)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
