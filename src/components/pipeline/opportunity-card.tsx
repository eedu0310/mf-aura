"use client";

import { useState } from "react";
import { Trash2, Edit2, ChevronRight, XCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { MotivoPerdaModal } from "./motivo-perda-modal";
import { marcarOportunidadeComoPerdida, recuperarOportunidade } from "@/lib/supabase/oportunidades-perdidas";
import type { Oportunidade, Etapa } from "@/lib/types";
import { calcularProximaMelhorAcao } from "@/lib/aura-prioridades";

const ETAPAS: Etapa[] = ["Prospecção", "Apresentação", "Proposta", "Negociação", "Fechados", "Perdidos"];

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(valor);
}

const CORES_ETAPA: Record<Etapa, string> = {
  Prospecção: "bg-blue-100 text-blue-700",
  Apresentação: "bg-purple-100 text-purple-700",
  Proposta: "bg-orange-100 text-orange-700",
  Negociação: "bg-yellow-100 text-yellow-700",
  Fechados: "bg-green-100 text-green-700",
  Perdidos: "bg-red-100 text-red-700",
};

const CORES_PROBABILIDADE: Record<string, string> = {
  Baixa: "text-red-600",
  Média: "text-yellow-600",
  Alta: "text-green-600",
};

export function OpportunityCard({
  oportunidade,
  onEditar,
  onDeletar,
  onAtualizar,
}: {
  oportunidade: Oportunidade;
  onEditar: (id: string) => void;
  onDeletar: (id: string) => void;
  onAtualizar?: () => void;
}) {
  const [marcandoPerdido, setMarcandoPerdido] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  const indiceEtapa = ETAPAS.indexOf(oportunidade.etapa);
  const percentualProgresso = ((indiceEtapa + 1) / ETAPAS.length) * 100;
  const ehPerdido = oportunidade.etapa === "Perdidos";
  const proximaAcao = calcularProximaMelhorAcao(oportunidade);

  async function handleMarcarComoPerdido(motivo: string, descricao: string) {
    setAtualizando(true);
    const ok = await marcarOportunidadeComoPerdida(oportunidade.id, motivo as any, descricao);
    setAtualizando(false);

    if (ok) {
      setMarcandoPerdido(false);
      onAtualizar?.();
    } else {
      alert("Não consegui marcar como perdido. Tente de novo.");
    }
  }

  async function handleRecuperar() {
    setAtualizando(true);
    const ok = await recuperarOportunidade(oportunidade.id);
    setAtualizando(false);

    if (ok) {
      onAtualizar?.();
    } else {
      alert("Não consegui recuperar a oportunidade. Tente de novo.");
    }
  }

  return (
    <>
      <div className={`rounded-2xl border-2 bg-white p-4 transition ${
        ehPerdido
          ? "border-red-300 opacity-75 bg-red-50"
          : "border-aura-mist hover:border-aura-petrol-300"
      }`}>
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-aura-graphite truncate">{oportunidade.cliente}</h3>
            <p className="text-sm text-aura-graphite-soft truncate">
              {oportunidade.descricao || "Oportunidade em andamento"}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            {!ehPerdido && (
              <button
                onClick={() => onEditar(oportunidade.id)}
                className="rounded-lg p-1.5 transition hover:bg-aura-bg"
                title="Editar"
              >
                <Edit2 size={14} className="text-aura-petrol-600" />
              </button>
            )}
            <button
              onClick={() => {
                if (confirm(`Deletar oportunidade de ${oportunidade.cliente}?`)) {
                  onDeletar(oportunidade.id);
                }
              }}
              className="rounded-lg p-1.5 transition hover:bg-red-50"
              title="Deletar"
            >
              <Trash2 size={14} className="text-aura-danger" />
            </button>
          </div>
        </div>

        {/* Valor */}
        <div className="mb-3">
          <p className="text-lg font-bold text-aura-graphite">
            {formatarMoeda(oportunidade.valor)}
          </p>
        </div>

        {/* Status e Probabilidade */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
              CORES_ETAPA[oportunidade.etapa]
            }`}
          >
            {oportunidade.etapa}
          </span>
          {!ehPerdido && (
            <span
              className={`text-xs font-medium ${
                CORES_PROBABILIDADE[oportunidade.probabilidade] || "text-gray-600"
              }`}
            >
              {oportunidade.probabilidade}
            </span>
          )}
        </div>

        {/* Motivo de Perda */}
        {ehPerdido && oportunidade.motivoPerda && (
          <div className="mb-3 rounded-lg bg-red-100 p-2.5">
            <div className="flex items-center gap-2">
              <XCircle size={14} className="text-red-700 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-red-700">{oportunidade.motivoPerda}</p>
                {oportunidade.descricaoPerda && (
                  <p className="text-xs text-red-600 mt-0.5">{oportunidade.descricaoPerda}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {!ehPerdido && (
          <Link href={proximaAcao.href} className="mb-3 flex items-start gap-2 rounded-xl border border-aura-gold/30 bg-aura-gold/10 p-2.5 transition hover:bg-aura-gold/20">
            <ArrowRight size={14} className="mt-0.5 shrink-0 text-aura-gold" />
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-aura-graphite">Próxima melhor ação: {proximaAcao.label}</span>
              <span className="mt-0.5 block text-[0.7rem] leading-relaxed text-aura-graphite-soft">{proximaAcao.descricao}</span>
            </span>
          </Link>
        )}

        {/* Progress Bar */}
        {!ehPerdido && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-aura-graphite-soft mb-1">
              <span>Progresso</span>
              <span>{Math.round(percentualProgresso)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-aura-mist">
              <div
                className="h-full rounded-full bg-aura-petrol-600 transition-all"
                style={{ width: `${percentualProgresso}%` }}
              />
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex items-center justify-between gap-2">
          {!ehPerdido && (
            <button
              onClick={() => setMarcandoPerdido(true)}
              className="text-xs font-medium text-aura-graphite-soft hover:text-aura-danger transition"
              disabled={atualizando}
            >
              ✕ Marcar como perdido
            </button>
          )}
          {ehPerdido && (
            <button
              onClick={handleRecuperar}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 transition"
              disabled={atualizando}
            >
              ↺ Recuperar
            </button>
          )}
          <ChevronRight size={14} className="text-aura-graphite-soft" />
        </div>
      </div>

      {marcandoPerdido && (
        <MotivoPerdaModal
          clienteNome={oportunidade.cliente}
          onConfirmar={handleMarcarComoPerdido}
          onCancelar={() => setMarcandoPerdido(false)}
        />
      )}
    </>
  );
}
