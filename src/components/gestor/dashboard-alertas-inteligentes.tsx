"use client";

import { AlertCircle, Activity, TrendingDown, Clock } from "lucide-react";

export interface AlertaDados {
  id: string;
  tipo: "risco" | "inatividade" | "leads-parados" | "oportunidade";
  titulo: string;
  descricao: string;
  severidade: "critica" | "alta" | "media";
  vendedor?: string;
  detalhes?: string;
}

export function DashboardAlertasInteligentes({ alertas }: { alertas: AlertaDados[] }) {
  const getIcone = (tipo: AlertaDados["tipo"]) => {
    switch (tipo) {
      case "risco":
        return <TrendingDown className="h-5 w-5" />;
      case "inatividade":
        return <Activity className="h-5 w-5" />;
      case "leads-parados":
        return <Clock className="h-5 w-5" />;
      default:
        return <AlertCircle className="h-5 w-5" />;
    }
  };

  const getCor = (severidade: AlertaDados["severidade"]) => {
    switch (severidade) {
      case "critica":
        return "border-aura-danger/30 bg-aura-danger/5 text-aura-danger";
      case "alta":
        return "border-aura-warning/30 bg-aura-warning/5 text-aura-warning";
      default:
        return "border-aura-info/30 bg-aura-info/5 text-aura-info";
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg font-semibold text-aura-graphite">
        🚨 Alertas Inteligentes
      </h3>

      {alertas.length === 0 ? (
        <div className="rounded-2xl border border-aura-success/30 bg-aura-success/5 p-4 text-center">
          <p className="text-sm text-aura-success">✅ Tudo certo! Nenhum alerta no momento.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alertas.map((alerta) => (
            <div
              key={alerta.id}
              className={`rounded-xl border p-4 ${getCor(alerta.severidade)}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{getIcone(alerta.tipo)}</div>
                <div className="flex-1">
                  <p className="font-semibold">{alerta.titulo}</p>
                  <p className="text-sm opacity-90">{alerta.descricao}</p>
                  {alerta.vendedor && (
                    <p className="mt-1 text-xs opacity-75">Vendedor: {alerta.vendedor}</p>
                  )}
                  {alerta.detalhes && (
                    <p className="mt-1 text-xs opacity-75">{alerta.detalhes}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}