"use client";

import { useState, useMemo } from "react";
import { Search, Plus, Edit2, Trash2, Phone, Mail, MapPin } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import { RelacionamentoDetailsModal } from "./relacionamento-details-modal";
import { NewRelationshipModal } from "./new-relationship-modal";
import type { Relacionamento } from "@/lib/types";

export function RelationshipsExplorer() {
  const { relacionamentos, deleteRelacionamento } = useAppData();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRelacionamento, setSelectedRelacionamento] = useState<Relacionamento | null>(null);

  async function excluirRelacionamento(id: string, nome: string) {
    if (!window.confirm(`Excluir o relacionamento de ${nome}? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteRelacionamento(id);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Não foi possível excluir o relacionamento.");
    }
  }
  const [filtroTemperatura, setFiltroTemperatura] = useState<string>("todos");
  const [showNovaModal, setShowNovaModal] = useState(false);

  const relacionamentosFiltrados = useMemo(() => {
    let resultado = relacionamentos;

    // Filtro de busca
    if (searchQuery.trim()) {
      const termo = searchQuery.toLowerCase();
      resultado = resultado.filter(
        (r) =>
          r.nome.toLowerCase().includes(termo) ||
          r.categoria.toLowerCase().includes(termo) ||
          r.telefone?.toLowerCase().includes(termo) ||
          r.email?.toLowerCase().includes(termo) ||
          r.cidade?.toLowerCase().includes(termo)
      );
    }

    // Filtro de temperatura
    if (filtroTemperatura !== "todos") {
      resultado = resultado.filter((r) => r.temperatura === filtroTemperatura);
    }

    return resultado;
  }, [relacionamentos, searchQuery, filtroTemperatura]);

  const temperaturaColors: Record<string, { bg: string; text: string; badge: string }> = {
    quente: {
      bg: "bg-red-50",
      text: "text-red-900",
      badge: "bg-red-100 text-red-700",
    },
    ativo: {
      bg: "bg-green-50",
      text: "text-green-900",
      badge: "bg-green-100 text-green-700",
    },
    esfriando: {
      bg: "bg-yellow-50",
      text: "text-yellow-900",
      badge: "bg-yellow-100 text-yellow-700",
    },
    frio: {
      bg: "bg-blue-50",
      text: "text-blue-900",
      badge: "bg-blue-100 text-blue-700",
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-aura-navy-950 px-6 pb-10 pt-8 sm:px-8">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-aura-gold/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-aura-petrol-500/10 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-7xl">
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Relacionamentos</h1>
          <p className="mt-1 text-sm text-white/50">
            Gerencie seus relacionamentos com clientes, parceiros e prospects.
          </p>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="mx-auto w-full max-w-7xl px-6 sm:px-8">
        <div className="space-y-4">
          {/* Barra de Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-aura-graphite-soft" size={18} />
            <input
              type="text"
              placeholder="Buscar por nome, categoria, telefone, email ou cidade..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-aura-mist bg-white pl-10 pr-4 py-2.5 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
            />
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFiltroTemperatura("todos")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                filtroTemperatura === "todos"
                  ? "bg-aura-petrol-700 text-white"
                  : "border border-aura-mist bg-white text-aura-graphite hover:border-aura-petrol-300"
              }`}
            >
              Todos
            </button>
            {["quente", "ativo", "esfriando", "frio"].map((temp) => (
              <button
                key={temp}
                onClick={() => setFiltroTemperatura(temp)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  filtroTemperatura === temp
                    ? `${temperaturaColors[temp].badge} ring-2 ring-offset-1`
                    : `border border-aura-mist bg-white text-aura-graphite hover:border-aura-petrol-300`
                }`}
              >
                {temp.charAt(0).toUpperCase() + temp.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lista de Relacionamentos */}
      <div className="mx-auto w-full max-w-7xl px-6 pb-24 sm:px-8">
        {relacionamentosFiltrados.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-aura-mist bg-aura-bg px-6 py-12 text-center">
            <p className="text-sm text-aura-graphite-soft">
              {searchQuery ? "Nenhum relacionamento encontrado." : "Nenhum relacionamento criado."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {relacionamentosFiltrados.map((rel) => (
              <div
                key={rel.id}
                className={`rounded-2xl border p-5 transition ${
                  temperaturaColors[rel.temperatura].bg
                } border-l-4 ${
                  {
                    quente: "border-l-red-500",
                    ativo: "border-l-green-500",
                    esfriando: "border-l-yellow-500",
                    frio: "border-l-blue-500",
                  }[rel.temperatura]
                }`}
              >
                {/* Header do Card */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className={`font-semibold ${temperaturaColors[rel.temperatura].text}`}>
                      {rel.nome}
                    </h3>
                    <p className="text-xs text-aura-graphite-soft mt-1">{rel.categoria}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      temperaturaColors[rel.temperatura].badge
                    }`}
                  >
                    {rel.temperatura}
                  </span>
                </div>

                {/* Contatos */}
                <div className="mt-4 space-y-2">
                  {rel.telefone && (
                    <div className="flex items-center gap-2 text-xs">
                      <Phone size={14} className="text-aura-graphite-soft" />
                      <span className="text-aura-graphite">{rel.telefone}</span>
                    </div>
                  )}
                  {rel.email && (
                    <div className="flex items-center gap-2 text-xs">
                      <Mail size={14} className="text-aura-graphite-soft" />
                      <span className="truncate text-aura-graphite">{rel.email}</span>
                    </div>
                  )}
                  {rel.cidade && (
                    <div className="flex items-center gap-2 text-xs">
                      <MapPin size={14} className="text-aura-graphite-soft" />
                      <span className="text-aura-graphite">{rel.cidade}</span>
                    </div>
                  )}
                </div>

                {/* Datas de Contato */}
                <div className="mt-4 space-y-1.5 border-t border-current border-opacity-10 pt-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-aura-graphite-soft">Último contato:</span>
                    <span className={`font-medium ${temperaturaColors[rel.temperatura].text}`}>
                      {rel.ultimoContato || "-"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-aura-graphite-soft">Próximo contato:</span>
                    <span className={`font-medium ${temperaturaColors[rel.temperatura].text}`}>
                      {rel.proximoContato}
                    </span>
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setSelectedRelacionamento(rel)}
                    className="flex-1 rounded-lg border border-aura-mist bg-white px-3 py-2 text-xs font-medium text-aura-graphite hover:bg-aura-bg transition flex items-center justify-center gap-1"
                  >
                    <Edit2 size={14} />
                    Editar
                  </button>
                  <button
                    onClick={() => excluirRelacionamento(rel.id, rel.nome)}
                    className="rounded-lg border border-aura-danger bg-aura-danger/10 px-3 py-2 text-xs font-medium text-aura-danger hover:bg-aura-danger/20 transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Botão Flutuante para Adicionar */}
      <button
        onClick={() => setShowNovaModal(true)}
        className="fixed bottom-8 right-8 z-30 hidden h-14 w-14 items-center justify-center rounded-full bg-aura-petrol-700 text-white shadow-lg transition hover:bg-aura-petrol-600 sm:flex"
        title="Adicionar novo relacionamento"
      >
        <Plus size={24} />
      </button>

      {/* Modal de Novo Relacionamento */}
      {showNovaModal && (
        <NewRelationshipModal
          onClose={() => setShowNovaModal(false)}
          onCriado={() => {
            setShowNovaModal(false);
          }}
        />
      )}

      {/* Modal de Detalhes */}
      {selectedRelacionamento && (
        <RelacionamentoDetailsModal
          relacionamento={selectedRelacionamento}
          onClose={() => setSelectedRelacionamento(null)}
          onDelete={() => setSelectedRelacionamento(null)}
        />
      )}
    </div>
  );
}
