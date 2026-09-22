"use client";

import { useMemo, useState } from "react";
import { Calendar, Check, Plus, Search, Trash2 } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import { NovaAtividadeModal } from "./nova-atividade-modal";
import type { Atividade, TipoAtividade } from "@/lib/types";

const TIPOS_ATIVIDADE: TipoAtividade[] = [
  "Ligação",
  "Email",
  "Visita",
  "Reunião",
  "Follow-up",
  "WhatsApp",
  "Orçamento",
  "Venda",
  "Prospecção",
  "Pós-venda",
  "Treinamento",
  "Outro",
];

type FiltroStatus = "todos" | "pendente" | "concluida";
type Ordenacao = "recente" | "antigo";

function atividadeConcluida(atividade: Atividade) {
  return atividade.proximoPasso?.trim().toLowerCase() === "encerrado";
}

function obterDataAtividade(atividade: Atividade) {
  const valor = atividade.ocorridaEm || atividade.quando || atividade.criadoEm;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? new Date(0) : data;
}

function formatarData(atividade: Atividade) {
  const data = obterDataAtividade(atividade);
  if (data.getTime() === 0) return "-";

  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatarHora(atividade: Atividade) {
  const data = obterDataAtividade(atividade);
  if (data.getTime() === 0) return "";

  return data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AtividadesView() {
  const { atividades, deleteAtividade } = useAppData();
  const [searchQuery, setSearchQuery] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<TipoAtividade | "todos">(
    "todos",
  );
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todos");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("recente");
  const [modalAberto, setModalAberto] = useState(false);

  const atividadesFiltradas = useMemo(() => {
    const termo = searchQuery.trim().toLocaleLowerCase("pt-BR");

    return [...(Array.isArray(atividades) ? atividades : [])]
      .filter((atividade) => {
        if (termo) {
          const conteudo = [
            atividade.titulo,
            atividade.contexto,
            atividade.anotacoes,
            atividade.clienteNome,
            atividade.clienteEmail,
            atividade.clienteTelefone,
            atividade.subtipo,
            atividade.resultado,
            atividade.proximoPasso,
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase("pt-BR");

          if (!conteudo.includes(termo)) return false;
        }

        if (filtroTipo !== "todos" && atividade.tipo !== filtroTipo) {
          return false;
        }

        const concluida = atividadeConcluida(atividade);
        if (filtroStatus === "concluida" && !concluida) return false;
        if (filtroStatus === "pendente" && concluida) return false;

        return true;
      })
      .sort((atividadeA, atividadeB) => {
        const dataA = obterDataAtividade(atividadeA).getTime();
        const dataB = obterDataAtividade(atividadeB).getTime();
        return ordenacao === "recente" ? dataB - dataA : dataA - dataB;
      });
  }, [atividades, filtroStatus, filtroTipo, ordenacao, searchQuery]);

  return (
    <div className="space-y-6">
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
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
            Atividades
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Acompanhe todas as suas atividades e próximos passos.
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-6 sm:px-8">
        <div className="space-y-4">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-aura-graphite-soft"
              size={18}
            />
            <input
              type="search"
              placeholder="Buscar por título, contexto ou cliente..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-lg border border-aura-mist bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFiltroStatus("todos")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  filtroStatus === "todos"
                    ? "bg-aura-petrol-700 text-white"
                    : "border border-aura-mist bg-white text-aura-graphite hover:border-aura-petrol-300"
                }`}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus("pendente")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  filtroStatus === "pendente"
                    ? "bg-aura-warning text-white"
                    : "border border-aura-mist bg-white text-aura-graphite hover:border-aura-warning/30"
                }`}
              >
                Pendentes
              </button>
              <button
                type="button"
                onClick={() => setFiltroStatus("concluida")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  filtroStatus === "concluida"
                    ? "bg-aura-success text-white"
                    : "border border-aura-mist bg-white text-aura-graphite hover:border-aura-success/30"
                }`}
              >
                Concluídas
              </button>
            </div>

            <div className="flex max-w-full flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFiltroTipo("todos")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  filtroTipo === "todos"
                    ? "bg-aura-petrol-700 text-white"
                    : "border border-aura-mist bg-white text-aura-graphite hover:border-aura-petrol-300"
                }`}
              >
                Todos os tipos
              </button>
              {TIPOS_ATIVIDADE.map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setFiltroTipo(tipo)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    filtroTipo === tipo
                      ? "bg-aura-petrol-500 text-white"
                      : "border border-aura-mist bg-white text-aura-graphite hover:border-aura-petrol-300"
                  }`}
                >
                  {tipo}
                </button>
              ))}
            </div>

            <select
              value={ordenacao}
              onChange={(event) =>
                setOrdenacao(event.target.value as Ordenacao)
              }
              aria-label="Ordenar atividades"
              className="rounded-full border border-aura-mist bg-white px-4 py-2 text-sm font-medium outline-none focus:border-aura-petrol-500"
            >
              <option value="recente">Mais recentes</option>
              <option value="antigo">Mais antigas</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-6 pb-24 sm:px-8">
        {atividadesFiltradas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-aura-mist bg-aura-bg px-6 py-12 text-center">
            <p className="text-sm text-aura-graphite-soft">
              {searchQuery
                ? "Nenhuma atividade encontrada."
                : "Nenhuma atividade criada."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {atividadesFiltradas.map((atividade) => {
              const concluida = atividadeConcluida(atividade);
              const hora = formatarHora(atividade);

              return (
                <article
                  key={atividade.id}
                  className={`rounded-xl border p-4 transition ${
                    concluida
                      ? "border-aura-success/20 bg-aura-success/5"
                      : "border-aura-mist bg-white hover:border-aura-petrol-300 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      aria-label={
                        concluida ? "Atividade concluída" : "Atividade pendente"
                      }
                      className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                        concluida
                          ? "border-aura-success bg-aura-success"
                          : "border-aura-mist bg-white"
                      }`}
                    >
                      {concluida && <Check size={14} className="text-white" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h3
                            className={`font-semibold ${
                              concluida
                                ? "text-aura-graphite-soft line-through"
                                : "text-aura-graphite"
                            }`}
                          >
                            {atividade.titulo}
                          </h3>
                          <p className="mt-1 text-sm text-aura-graphite-soft">
                            {atividade.contexto}
                          </p>
                        </div>
                        <span className="inline-block shrink-0 rounded-full bg-aura-petrol-100 px-2.5 py-1 text-xs font-medium text-aura-petrol-700">
                          {atividade.tipo}
                        </span>
                      </div>

                      {atividade.anotacoes && (
                        <p className="mt-3 text-sm text-aura-graphite-soft">
                          {atividade.anotacoes}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-aura-graphite-soft">
                        <div className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatarData(atividade)}
                          {hora && <span>{hora}</span>}
                        </div>
                        {atividade.proximoPasso && (
                          <span>Próximo: {atividade.proximoPasso}</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm("Excluir esta atividade permanentemente?")) return;
                        const excluida = await deleteAtividade(atividade.id);
                        if (!excluida) window.alert("Não foi possível excluir a atividade no banco de dados.");
                      }}
                      aria-label="Excluir atividade"
                      title="Excluir atividade"
                      className="shrink-0 rounded-lg border border-aura-mist bg-white p-2 text-aura-danger transition hover:bg-aura-danger/10"
                    >
                      <Trash2 size={14} className="text-aura-danger" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setModalAberto(true)}
        className="fixed bottom-8 right-8 z-30 hidden h-14 w-14 items-center justify-center rounded-full bg-aura-petrol-700 text-white shadow-lg transition hover:bg-aura-petrol-600 sm:flex"
        title="Adicionar nova atividade"
        aria-label="Adicionar nova atividade"
      >
        <Plus size={24} />
      </button>

      {modalAberto && (
        <NovaAtividadeModal
          onClose={() => setModalAberto(false)}
          onCriada={() => setModalAberto(false)}
        />
      )}
    </div>
  );
}
