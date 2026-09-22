"use client";

import { useState } from "react";
import { ArrowLeft, Edit2, Trash2 } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import type { Relacionamento } from "@/lib/types";

interface RelationshipDetailProps {
  relacionamento: Relacionamento;
  onVoltar: () => void;
  onEditar?: (r: Relacionamento) => void;
}

export function RelationshipDetail({
  relacionamento: r,
  onVoltar,
  onEditar,
}: RelationshipDetailProps) {
  const { deleteRelacionamento } = useAppData();
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  function calcularDiasDesdeContato(): number | null {
    if (!r.ultimoContato) return null;
    const ultimo = new Date(r.ultimoContato);
    const agora = new Date();
    const diferenca = agora.getTime() - ultimo.getTime();
    return Math.floor(diferenca / (1000 * 60 * 60 * 24));
  }

  function excluir() {
    if (confirm(`Deletar relacionamento de ${r.nome}?`)) {
      deleteRelacionamento(r.id);
      onVoltar();
    }
  }

  const diasDesdeContato = calcularDiasDesdeContato();

  const CORES_TEMPERATURA: Record<string, string> = {
    quente: "bg-green-100 text-green-700",
    morno: "bg-blue-100 text-blue-700",
    esfriando: "bg-yellow-100 text-yellow-700",
    frio: "bg-red-100 text-red-700",
  };

  return (
    <div className="rounded-2xl border border-aura-mist bg-white p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <button
            onClick={onVoltar}
            className="mb-3 flex items-center gap-2 text-sm font-medium text-aura-petrol-600 hover:text-aura-petrol-700"
          >
            <ArrowLeft size={16} />
            Voltar
          </button>
          <h1 className="font-display text-3xl font-bold text-aura-graphite">
            {r.nome}
          </h1>
          <p className="text-sm text-aura-graphite-soft">{r.categoria}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onEditar?.(r)}
            className="rounded-lg border border-aura-mist bg-white px-3 py-2 transition hover:bg-aura-bg"
            title="Editar"
          >
            <Edit2 size={16} className="text-aura-petrol-600" />
          </button>
          <button
            onClick={() => setConfirmandoExclusao(true)}
            className="rounded-lg border border-aura-mist bg-white px-3 py-2 transition hover:bg-red-50"
            title="Deletar"
          >
            <Trash2 size={16} className="text-aura-danger" />
          </button>
        </div>
      </div>

      {confirmandoExclusao && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="mb-3 text-sm font-medium text-aura-graphite">
            Tem certeza que deseja deletar este relacionamento?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmandoExclusao(false)}
              className="flex-1 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-aura-graphite transition hover:bg-red-50"
            >
              Cancelar
            </button>
            <button
              onClick={excluir}
              className="flex-1 rounded-lg bg-aura-danger px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700"
            >
              Deletar
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-lg border border-aura-mist bg-aura-bg p-4">
          <p className="text-xs font-medium uppercase text-aura-graphite-soft">
            Contato
          </p>
          <div className="mt-3 space-y-2">
            {r.telefone && (
              <div>
                <p className="text-xs text-aura-graphite-soft">Telefone</p>
                <p className="text-sm font-medium text-aura-graphite">
                  {r.telefone}
                </p>
              </div>
            )}
            {r.email && (
              <div>
                <p className="text-xs text-aura-graphite-soft">Email</p>
                <p className="text-sm font-medium text-aura-graphite">
                  {r.email}
                </p>
              </div>
            )}
            {r.cidade && (
              <div>
                <p className="text-xs text-aura-graphite-soft">Cidade</p>
                <p className="text-sm font-medium text-aura-graphite">
                  {r.cidade}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-aura-mist bg-aura-bg p-4">
          <p className="text-xs font-medium uppercase text-aura-graphite-soft">
            Temperatura
          </p>
          <div className="mt-3">
            <span
              className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${
                CORES_TEMPERATURA[r.temperatura] || "bg-gray-100 text-gray-700"
              }`}
            >
              {r.temperatura.charAt(0).toUpperCase() + r.temperatura.slice(1)}
            </span>
            {diasDesdeContato !== null && (
              <p className="mt-2 text-xs text-aura-graphite-soft">
                Ultimo contato: {diasDesdeContato} dias atras
              </p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-aura-mist bg-aura-bg p-4">
          <p className="text-xs font-medium uppercase text-aura-graphite-soft">
            Proximo Contato
          </p>
          <p className="mt-3 text-sm font-medium text-aura-graphite">
            {r.proximoContato}
          </p>
        </div>

        {r.valor && (
          <div className="rounded-lg border border-aura-mist bg-aura-bg p-4">
            <p className="text-xs font-medium uppercase text-aura-graphite-soft">
              Valor Potencial
            </p>
            <p className="mt-3 text-sm font-medium text-aura-graphite">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(r.valor)}
            </p>
          </div>
        )}

        {r.valorGerado && (
          <div className="rounded-lg border border-aura-mist bg-aura-bg p-4">
            <p className="text-xs font-medium uppercase text-aura-graphite-soft">
              Valor Gerado
            </p>
            <p className="mt-3 text-sm font-medium text-aura-success">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(r.valorGerado)}
            </p>
          </div>
        )}
      </div>

      {r.criadoEm && (
        <div className="mt-6 border-t border-aura-mist pt-4">
          <p className="text-xs text-aura-graphite-soft">
            Adicionado em {new Date(r.criadoEm).toLocaleDateString("pt-BR")}
          </p>
        </div>
      )}
    </div>
  );
}