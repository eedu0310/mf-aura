"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";

export function SparklineChart({ data }: { data: number[] }) {
  const pontos = data.map((valor, i) => ({ i, valor }));

  return (
    <div className="h-12 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pontos} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="valor"
            stroke="var(--aura-petrol-500)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
