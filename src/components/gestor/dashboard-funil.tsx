"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface FunilEstgio {
  nome: string;
  quantidade: number;
  valor: number;
}

export function DashboardFunil({ dados }: { dados: FunilEstgio[] }) {
  const total = dados[0]?.quantidade || 1;

  const dataGrafico = dados.map((item) => ({
    ...item,
    percentual: ((item.quantidade / total) * 100).toFixed(1),
  }));

  const cores = ["#00b4a6", "#3498db", "#f39c12", "#e74c3c"];

  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg font-semibold text-aura-graphite">
        📊 Funil de Vendas
      </h3>

      <div className="rounded-2xl border border-aura-mist bg-white p-5">
        {/* Dados tabulares */}
        <div className="mb-6 space-y-2">
          {dataGrafico.map((item, idx) => (
            <div key={item.nome} className="flex items-center gap-3">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: cores[idx] }}
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-aura-graphite">{item.nome}</p>
                <div className="mt-0.5 h-2 rounded-full bg-aura-mist overflow-hidden">
                  <div
                    className="h-full transition"
                    style={{
                      width: "100%",
                      backgroundColor: cores[idx],
                    }}
                  />
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-aura-graphite">
                  {item.quantidade}
                </p>
                <p className="text-xs text-aura-graphite-soft">
                  {item.percentual}%
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Gráfico */}
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dataGrafico}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8f0f5" />
            <XAxis dataKey="nome" stroke="#8b92a1" />
            <YAxis stroke="#8b92a1" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e8f0f5",
                borderRadius: "8px",
              }}
            />
            <Bar dataKey="quantidade" fill="#00b4a6">
              {dataGrafico.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={cores[index]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}