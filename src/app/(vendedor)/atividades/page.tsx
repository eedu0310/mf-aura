"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  Filter,
  MapPin,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import { AuraInsightCard } from "@/components/aura/aura-insight-card";
import { useUserProfile } from "@/lib/user-profile-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Atividade, TipoAtividade } from "@/lib/types";

const TIPOS_ATIVIDADE: TipoAtividade[] = [
  "Visita",
  "Reunião",
  "Follow-up",
  "Ligação",
  "WhatsApp",
  "Email",
  "Orçamento",
  "Venda",
  "Prospecção",
  "Pós-venda",
  "Treinamento",
  "Outro",
];

const CORES_TIPO: Record<TipoAtividade, string> = {
  Visita: "bg-blue-100 text-blue-700",
  Reunião: "bg-purple-100 text-purple-700",
  "Follow-up": "bg-orange-100 text-orange-700",
  Ligação: "bg-green-100 text-green-700",
  WhatsApp: "bg-emerald-100 text-emerald-700",
  Email: "bg-cyan-100 text-cyan-700",
  Orçamento: "bg-amber-100 text-amber-700",
  Venda: "bg-teal-100 text-teal-700",
  Prospecção: "bg-indigo-100 text-indigo-700",
  "Pós-venda": "bg-pink-100 text-pink-700",
  Treinamento: "bg-violet-100 text-violet-700",
  Outro: "bg-gray-100 text-gray-700",
};

type FiltroStatus = "Todas" | "Pendentes" | "Concluídas";

function obterOwnerId(atividade: Atividade) {
  return atividade.ownerId || atividade.vendedorId;
}

function obterDataAtividade(atividade: Atividade) {
  const valor = atividade.ocorridaEm || atividade.criadoEm || atividade.quando;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? new Date(0) : data;
}

function atividadeConcluida(atividade: Atividade) {
  return atividade.proximoPasso?.trim().toLowerCase() === "encerrado";
}

export default function AtividadesPage() {
  const { atividades, nomesPorOwnerId, deleteAtividade } = useAppData();
  const [excluindo, setExcluindo] = useState<string | null>(null);

  /** Remove uma atividade lançada por engano. */
  async function excluirAtividade(id: string, titulo: string) {
    if (!window.confirm(`Excluir "${titulo}"? Ela sai do seu histórico e das contagens.`)) return;
    setExcluindo(id);
    try {
      const ok = await deleteAtividade(id);
      if (!ok) window.alert("Não consegui excluir a atividade. Verifique suas permissões.");
    } finally {
      setExcluindo(null);
    }
  }
  const { profile } = useUserProfile();

  const [busca, setBusca] = useState("");
  const [tipoSelecionado, setTipoSelecionado] = useState<
    TipoAtividade | "Todas"
  >("Todas");
  const [statusFiltro, setStatusFiltro] = useState<FiltroStatus>("Todas");
  const [userId, setUserId] = useState<string | null>(null);
  const [authCarregando, setAuthCarregando] = useState(true);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const vejoTudo = profile.cargo === "Gestor";

  useEffect(() => {
    if (!supabase) {
      setUserId(null);
      setAuthCarregando(false);
      return;
    }

    const supabaseClient = supabase;
    let activo = true;

    async function carregarUtilizador() {
      try {
        const {
          data: { user },
          error,
        } = await supabaseClient.auth.getUser();

        if (!activo) return;
        if (error) {
          console.error("Erro ao obter utilizador autenticado:", error);
          setUserId(null);
          return;
        }

        setUserId(user?.id ?? null);
      } catch (error) {
        if (activo) {
          console.error("Erro ao obter utilizador autenticado:", error);
          setUserId(null);
        }
      } finally {
        if (activo) setAuthCarregando(false);
      }
    }

    void carregarUtilizador();

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (!activo) return;
      setUserId(session?.user.id ?? null);
      setAuthCarregando(false);
    });

    return () => {
      activo = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const atividadesFiltradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");

    return [...atividades]
      .filter((atividade) => {
        const ownerId = obterOwnerId(atividade);

        if (!vejoTudo) {
          if (authCarregando || !userId) return false;
          if (ownerId !== userId) return false;
        }

        if (tipoSelecionado !== "Todas" && atividade.tipo !== tipoSelecionado) {
          return false;
        }

        if (statusFiltro === "Pendentes" && atividadeConcluida(atividade)) {
          return false;
        }

        if (statusFiltro === "Concluídas" && !atividadeConcluida(atividade)) {
          return false;
        }

        if (termo) {
          const vendedor = nomesPorOwnerId[ownerId] || "";
          const conteudo = [
            atividade.titulo,
            atividade.contexto,
            atividade.anotacoes,
            atividade.clienteNome,
            atividade.clienteEmail,
            atividade.clienteTelefone,
            atividade.subtipo,
            vendedor,
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase("pt-BR");

          if (!conteudo.includes(termo)) {
            return false;
          }
        }

        return true;
      })
      .sort(
        (atividadeA, atividadeB) =>
          obterDataAtividade(atividadeB).getTime() -
          obterDataAtividade(atividadeA).getTime(),
      );
  }, [
    atividades,
    authCarregando,
    busca,
    nomesPorOwnerId,
    statusFiltro,
    tipoSelecionado,
    userId,
    vejoTudo,
  ]);

  return (
    <div className="space-y-6 pb-24">
      <div className="relative overflow-hidden bg-aura-navy-950 px-6 pb-10 pt-8 sm:px-8">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-7xl">
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
            Atividades
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Todas as suas atividades registradas com localização
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-6 sm:px-8">
        <AuraInsightCard pagina="atividades" />
      </div>

      <div className="mx-auto w-full max-w-7xl space-y-4 px-6 sm:px-8">
        <div className="rounded-lg border border-aura-mist bg-white p-4">
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search
                className="absolute left-3 top-3 text-aura-graphite-soft"
                size={18}
              />
              <input
                type="search"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar por título, contexto, cliente ou vendedor..."
                className="w-full rounded-lg border border-aura-mist py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-aura-navy-950"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-aura-graphite-soft" />
                <span className="text-sm font-medium text-aura-graphite">
                  Tipo:
                </span>
                <select
                  value={tipoSelecionado}
                  onChange={(event) =>
                    setTipoSelecionado(
                      event.target.value as TipoAtividade | "Todas",
                    )
                  }
                  className="rounded border border-aura-mist px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-aura-navy-950"
                >
                  <option value="Todas">Todas</option>
                  {TIPOS_ATIVIDADE.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </div>

              <select
                value={statusFiltro}
                onChange={(event) =>
                  setStatusFiltro(event.target.value as FiltroStatus)
                }
                className="rounded border border-aura-mist px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-aura-navy-950"
              >
                <option value="Todas">Todas as atividades</option>
                <option value="Pendentes">Pendentes</option>
                <option value="Concluídas">Concluídas</option>
              </select>
            </div>
          </div>
        </div>

        {atividadesFiltradas.length === 0 ? (
          <div className="rounded-lg border border-aura-mist bg-white p-8 text-center">
            <AlertCircle
              size={32}
              className="mx-auto mb-3 text-aura-graphite-soft"
            />
            <p className="text-aura-graphite-soft">
              Nenhuma atividade encontrada
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {atividadesFiltradas.map((atividade) => {
              const ownerId = obterOwnerId(atividade);
              const data = obterDataAtividade(atividade);
              const possuiDataValida = data.getTime() > 0;
              const dataFormatada = possuiDataValida
                ? data.toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })
                : "Data não informada";
              const horaFormatada = possuiDataValida
                ? data.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";
              const possuiCoordenadas =
                typeof atividade.latitude === "number" &&
                typeof atividade.longitude === "number";

              return (
                <article
                  key={atividade.id}
                  className="rounded-lg border border-aura-mist bg-white p-4 transition hover:border-aura-graphite-soft"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-block rounded-md px-2 py-1 text-xs font-medium ${
                            CORES_TIPO[atividade.tipo] || CORES_TIPO.Outro
                          }`}
                        >
                          {atividade.tipo}
                        </span>
                        {atividade.subtipo && (
                          <span className="text-xs text-aura-graphite-soft">
                            {atividade.subtipo}
                          </span>
                        )}
                        {vejoTudo && (
                          <span className="text-xs text-aura-graphite-soft">
                            por {nomesPorOwnerId[ownerId] || "Desconhecido"}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-aura-graphite">
                        {atividade.titulo}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => void excluirAtividade(atividade.id, atividade.titulo)}
                      disabled={excluindo === atividade.id}
                      title="Excluir esta atividade"
                      aria-label={`Excluir ${atividade.titulo}`}
                      className="shrink-0 rounded-lg p-2 text-aura-graphite-soft transition hover:bg-red-50 hover:text-aura-danger disabled:opacity-40"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {atividade.contexto && (
                    <p className="mb-3 text-sm text-aura-graphite-soft">
                      {atividade.contexto}
                    </p>
                  )}

                  {atividade.anotacoes && (
                    <div className="mb-3 rounded bg-aura-bg p-2">
                      <p className="text-xs text-aura-graphite-soft">
                        {atividade.anotacoes}
                      </p>
                    </div>
                  )}

                  {(atividade.endereco || possuiCoordenadas) && (
                    <div className="mb-3 rounded-lg border border-green-200 bg-green-50 p-3">
                      <button
                        type="button"
                        disabled={!possuiCoordenadas}
                        onClick={() => {
                          if (!possuiCoordenadas) return;
                          const url = `https://www.google.com/maps/?q=${atividade.latitude},${atividade.longitude}`;
                          window.open(url, "_blank", "noopener,noreferrer");
                        }}
                        className="flex w-full items-start gap-2 text-left transition hover:opacity-80 disabled:cursor-default"
                      >
                        <MapPin
                          size={16}
                          className="mt-0.5 shrink-0 text-green-600"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-green-700">
                            {atividade.endereco || "Localização capturada"}
                          </p>
                          {possuiCoordenadas && (
                            <>
                              <p className="mt-1 text-xs text-green-600">
                                {atividade.latitude?.toFixed(5)},{" "}
                                {atividade.longitude?.toFixed(5)}
                              </p>
                              <p className="mt-1 text-xs text-green-600 underline">
                                Abrir no Google Maps →
                              </p>
                            </>
                          )}
                        </div>
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-4 border-t border-aura-mist pt-2 text-xs text-aura-graphite-soft">
                    <div className="flex items-center gap-1">
                      <Calendar size={14} />
                      {dataFormatada}
                    </div>
                    {horaFormatada && <div>{horaFormatada}</div>}
                    {atividade.proximoPasso && (
                      <div className="ml-auto truncate">
                        Próximo: {atividade.proximoPasso}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <Link
          href="/registrar-atividade"
          aria-label="Registrar nova atividade"
          className="fixed bottom-8 right-8 hidden h-14 w-14 items-center justify-center rounded-full bg-aura-navy-950 text-white shadow-lg transition hover:bg-aura-navy-900 sm:flex"
        >
          <Plus size={24} />
        </Link>
      </div>
    </div>
  );
}
