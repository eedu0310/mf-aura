"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { SearchRelationshipField } from "@/components/registrar-atividade/search-relationship-field";
import type { Relacionamento } from "@/lib/types";
import type { Compromisso, TipoCompromisso } from "@/lib/supabase/compromissos";

const TIPOS: TipoCompromisso[] = ["Visita", "Reunião", "Follow-up", "Ligação", "Outro"];

export function CompromissoModal({
  dataInicial,
  compromissoExistente,
  onClose,
  onSalvar,
}: {
  dataInicial: string;
  compromissoExistente?: Compromisso;
  onClose: () => void;
  onSalvar: (dados: {
    titulo: string;
    subtitulo?: string;
    tipo: TipoCompromisso;
    relacionamentoNome?: string;
    data: string;
    hora?: string;
  }) => void;
}) {
  const [titulo, setTitulo] = useState(compromissoExistente?.titulo ?? "");
  const [subtitulo, setSubtitulo] = useState(compromissoExistente?.subtitulo ?? "");
  const [tipo, setTipo] = useState<TipoCompromisso>(compromissoExistente?.tipo ?? "Visita");
  const [relacionamento, setRelacionamento] = useState<Relacionamento | null>(null);
  const [data, setData] = useState(compromissoExistente?.data ?? dataInicial);
  const [hora, setHora] = useState(compromissoExistente?.hora ?? "");

  const podeSalvar = titulo.trim().length > 0 && data;

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!podeSalvar) return;
    onSalvar({
      titulo: titulo.trim(),
      subtitulo: subtitulo.trim() || undefined,
      tipo,
      relacionamentoNome: relacionamento?.nome ?? compromissoExistente?.relacionamentoNome ?? undefined,
      data,
      hora: hora || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <p className="font-display text-lg font-semibold text-aura-graphite">
            {compromissoExistente ? "Editar compromisso" : "Novo compromisso"}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-aura-graphite-soft hover:text-aura-graphite"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={salvar} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-aura-graphite">Título</label>
            <input
              type="text"
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Visita à Construtora Alpha"
              className="w-full rounded-xl border border-aura-mist bg-white px-4 py-2.5 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-aura-graphite">Tipo</label>
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    tipo === t
                      ? "border-aura-petrol-700 bg-aura-petrol-700 text-white"
                      : "border-aura-mist bg-white text-aura-graphite hover:border-aura-petrol-500/50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <SearchRelationshipField
            label="Vincular a um relacionamento (opcional)"
            value={relacionamento}
            onChange={setRelacionamento}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-aura-graphite">Data</label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full rounded-xl border border-aura-mist bg-white px-3 py-2.5 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-aura-graphite">Hora</label>
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="w-full rounded-xl border border-aura-mist bg-white px-3 py-2.5 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
              Observação (opcional)
            </label>
            <input
              type="text"
              value={subtitulo}
              onChange={(e) => setSubtitulo(e.target.value)}
              placeholder="Ex.: Levar catálogo atualizado"
              className="w-full rounded-xl border border-aura-mist bg-white px-4 py-2.5 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
            />
          </div>

          <button
            type="submit"
            disabled={!podeSalvar}
            className="mt-1 rounded-xl bg-aura-petrol-700 py-2.5 text-sm font-semibold text-white transition hover:bg-aura-petrol-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Salvar compromisso
          </button>
        </form>
      </div>
    </div>
  );
}