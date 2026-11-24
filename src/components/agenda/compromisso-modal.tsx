"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { classeBotao, Segmentado } from "@/components/ui";
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
    duracaoMinutos?: number;
    local?: string;
    observacao?: string;
    relacionamentoId?: string;
  }) => void;
}) {
  const [titulo, setTitulo] = useState(compromissoExistente?.titulo ?? "");
  const [subtitulo, setSubtitulo] = useState(compromissoExistente?.subtitulo ?? "");
  const [tipo, setTipo] = useState<TipoCompromisso>(compromissoExistente?.tipo ?? "Visita");
  const [relacionamento, setRelacionamento] = useState<Relacionamento | null>(null);
  const [data, setData] = useState(compromissoExistente?.data ?? dataInicial);
  const [hora, setHora] = useState(compromissoExistente?.hora ?? "");
  const [duracao, setDuracao] = useState(String(compromissoExistente?.duracaoMinutos ?? 60));
  const [local, setLocal] = useState(compromissoExistente?.local ?? "");
  const [observacao, setObservacao] = useState(compromissoExistente?.observacao ?? "");

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
      duracaoMinutos: Number(duracao) || 60,
      local: local.trim() || undefined,
      observacao: observacao.trim() || undefined,
      relacionamentoId: relacionamento?.id ?? compromissoExistente?.relacionamentoId ?? undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="aura-card max-h-[90vh] w-full max-w-md overflow-y-auto p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <p className="font-display text-lg font-semibold text-aura-graphite">
            {compromissoExistente ? "Editar compromisso" : "Novo compromisso"}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className={classeBotao("fantasma", "sm", "w-8 px-0")}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={salvar} className="flex flex-col gap-4">
          <div>
            <label className="aura-label">Título</label>
            <input
              type="text"
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Visita à Construtora Alpha"
              className="aura-input"
            />
          </div>

          <div>
            <label className="aura-label">Tipo</label>
            <Segmentado
              rotulo="Tipo"
              opcoes={TIPOS.map((t) => ({ valor: t, rotulo: t }))}
              valor={tipo}
              aoMudar={setTipo}
            />
          </div>

          <SearchRelationshipField
            label="Vincular a um relacionamento (opcional)"
            value={relacionamento}
            onChange={setRelacionamento}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="aura-label">Data</label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="aura-input"
              />
            </div>
            <div>
              <label className="aura-label">Hora</label>
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="aura-input"
              />
            </div>
          </div>

          <div>
            <label className="aura-label">
              Duração
            </label>
            <Segmentado
              rotulo="Duração"
              opcoes={[30, 60, 90, 120].map((m) => ({
                valor: String(m),
                rotulo: m < 60 ? `${m} min` : `${m / 60}h`,
              }))}
              valor={String(Number(duracao))}
              aoMudar={setDuracao}
            />
            <p className="mt-1.5 text-xs text-aura-graphite-soft">
              Usada para reservar o horário no calendário do seu celular.
            </p>
          </div>

          <div>
            <label className="aura-label">
              Local (opcional)
            </label>
            <input
              type="text"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Ex.: Obra na Av. Ipiranga, 300"
              className="aura-input"
            />
          </div>

          <div>
            <label className="aura-label">
              Observação (opcional)
            </label>
            <input
              type="text"
              value={subtitulo}
              onChange={(e) => setSubtitulo(e.target.value)}
              placeholder="Ex.: Levar catálogo atualizado"
              className="aura-input"
            />
          </div>

          <div>
            <label className="aura-label">
              Anotações para você (opcional)
            </label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              placeholder="O que precisa estar pronto, o que combinar..."
              className="aura-input resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={!podeSalvar}
            className={classeBotao("primario", "lg", "mt-1 w-full")}
          >
            Salvar compromisso
          </button>
        </form>
      </div>
    </div>
  );
}
