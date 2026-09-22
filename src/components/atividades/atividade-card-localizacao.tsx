"use client";

import { MapPin, Calendar, FileText, Trash2 } from "lucide-react";
import type { AtividadeComLocalizacao } from "@/lib/hooks/useAtividadesComLocalizacao";

interface AtividadeCardLocalizacaoProps {
  atividade: AtividadeComLocalizacao;
  onDelete?: (id: string) => void;
}

export function AtividadeCardLocalizacao({
  atividade,
  onDelete,
}: AtividadeCardLocalizacaoProps) {
  const data = new Date(atividade.created_at);
  const dataFormatada = data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const horaFormatada = data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  function abrirNoMapa() {
    if (atividade.latitude && atividade.longitude) {
      const url = `https://www.google.com/maps/?q=${atividade.latitude},${atividade.longitude}`;
      window.open(url, "_blank");
    }
  }

  return (
    <div className="rounded-lg border border-aura-mist bg-white p-4 hover:border-aura-graphite-soft transition">
      {/* Tipo e Título */}
      <div className="mb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="inline-block rounded-md bg-aura-bg px-2 py-1 text-xs font-medium text-aura-graphite mb-2">
              {atividade.tipo || "Outra"}
            </span>
            <h3 className="font-semibold text-aura-graphite">{atividade.titulo}</h3>
          </div>
          {onDelete && (
            <button
              onClick={() => onDelete(atividade.id)}
              className="text-aura-graphite-soft hover:text-red-600 transition"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Contexto */}
      {atividade.contexto && (
        <p className="text-sm text-aura-graphite mb-3">{atividade.contexto}</p>
      )}

      {/* Observação */}
      {atividade.observacao && (
        <div className="mb-3 rounded bg-aura-bg p-2">
          <p className="text-xs text-aura-graphite-soft">{atividade.observacao}</p>
        </div>
      )}

      {/* Localização */}
      {atividade.endereco && (
        <div className="mb-3 rounded-lg bg-green-50 p-3 border border-green-200">
          <button
            onClick={abrirNoMapa}
            className="flex items-start gap-2 w-full text-left hover:opacity-80 transition"
          >
            <MapPin size={16} className="text-green-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-green-700 truncate">
                📍 {atividade.endereco}
              </p>
              {atividade.latitude && atividade.longitude && (
                <p className="text-xs text-green-600 mt-1">
                  {atividade.latitude.toFixed(5)}, {atividade.longitude.toFixed(5)}
                </p>
              )}
              <p className="text-xs text-green-600 mt-1 underline">
                Abrir no Google Maps →
              </p>
            </div>
          </button>
        </div>
      )}

      {/* Data e Hora */}
      <div className="flex items-center gap-4 text-xs text-aura-graphite-soft">
        <div className="flex items-center gap-1">
          <Calendar size={14} />
          {dataFormatada}
        </div>
        <div>{horaFormatada}</div>
      </div>
    </div>
  );
}