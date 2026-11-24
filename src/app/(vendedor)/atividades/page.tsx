"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
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
import { PageContainer, PageHeader, Selo, Segmentado, EstadoVazio, type Tom } from "@/components/ui";
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

// Selo discreto por tipo: poucas cores do tema em vez de um arco-íris.
const TOM_TIPO: Record<TipoAtividade, Tom> = {
  Visita: "marca",
  Reunião: "marca",
  "Follow-up": "atencao",
  Ligação: "neutro",
  WhatsApp: "sucesso",
  Email: "neutro",
  Orçamento: "ouro",
  Venda: "sucesso",
  Prospecção: "marca",
  "Pós-venda": "neutro",
  Treinamento: "neutro",
  Outro: "neutro",
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
      await deleteAtividade(id);
    } catch (erro) {
      window.alert(erro instanceof Error ? erro.message : "Não consegui excluir a atividade.");
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
    <PageContainer>
      <PageHeader
        titulo="Atividades"
        descricao="Todas as suas atividades registradas com localização"
        icone={Activity}
      />

      <div className="space-y-4">
        <AuraInsightCard pagina="atividades" />

        <div className="aura-card p-4">
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-aura-graphite-soft"
                size={16}
              />
              <input
                type="search"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar por título, contexto, cliente ou vendedor..."
                className="aura-input pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter size={15} className="text-aura-graphite-soft" />
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
                  className="aura-input h-9 w-auto"
                >
                  <option value="Todas">Todas</option>
                  {TIPOS_ATIVIDADE.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </div>

              <Segmentado
                rotulo="Situação"
                opcoes={[
                  { valor: "Todas", rotulo: "Todas as atividades" },
                  { valor: "Pendentes", rotulo: "Pendentes" },
                  { valor: "Concluídas", rotulo: "Concluídas" },
                ]}
                valor={statusFiltro}
                aoMudar={setStatusFiltro}
              />
            </div>
          </div>
        </div>

        {atividadesFiltradas.length === 0 ? (
          <EstadoVazio icone={AlertCircle} titulo="Nenhuma atividade encontrada" />
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
                  className="aura-card aura-card-interativo p-4"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <Selo tom={TOM_TIPO[atividade.tipo] || TOM_TIPO.Outro}>
                          {atividade.tipo}
                        </Selo>
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
                      <h3 className="text-sm font-semibold text-aura-graphite">
                        {atividade.titulo}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => void excluirAtividade(atividade.id, atividade.titulo)}
                      disabled={excluindo === atividade.id}
                      title="Excluir esta atividade"
                      aria-label={`Excluir ${atividade.titulo}`}
                      className="shrink-0 rounded-lg p-2 text-aura-graphite-soft transition hover:bg-aura-danger/10 hover:text-aura-danger disabled:opacity-40"
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
                    <div className="mb-3 rounded-lg bg-aura-sunken px-3 py-2">
                      <p className="text-xs text-aura-graphite-soft">
                        {atividade.anotacoes}
                      </p>
                    </div>
                  )}

                  {(atividade.endereco || possuiCoordenadas) && (
                    <div className="mb-3 rounded-lg border border-aura-mist p-3">
                      <button
                        type="button"
                        disabled={!possuiCoordenadas}
                        onClick={() => {
                          if (!possuiCoordenadas) return;
                          const url = `https://www.google.com/maps/?q=${atividade.latitude},${atividade.longitude}`;
                          window.open(url, "_blank", "noopener,noreferrer");
                        }}
                        className="group flex w-full items-start gap-2 text-left disabled:cursor-default"
                      >
                        <MapPin
                          size={15}
                          className="mt-0.5 shrink-0 text-aura-success"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-aura-graphite">
                            {atividade.endereco || "Localização capturada"}
                          </p>
                          {possuiCoordenadas && (
                            <>
                              <p className="mt-1 text-xs tabular-nums text-aura-graphite-soft">
                                {atividade.latitude?.toFixed(5)},{" "}
                                {atividade.longitude?.toFixed(5)}
                              </p>
                              <p className="mt-1 text-xs font-medium text-aura-petrol-600 group-hover:underline">
                                Abrir no Google Maps →
                              </p>
                            </>
                          )}
                        </div>
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-4 border-t border-aura-mist pt-2.5 text-xs text-aura-graphite-soft">
                    <div className="flex items-center gap-1 tabular-nums">
                      <Calendar size={13} />
                      {dataFormatada}
                    </div>
                    {horaFormatada && <div className="tabular-nums">{horaFormatada}</div>}
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
          className="fixed bottom-8 right-8 hidden h-12 w-12 items-center justify-center rounded-full bg-aura-petrol-600 text-white shadow-xl transition hover:bg-aura-petrol-700 sm:flex"
        >
          <Plus size={22} />
        </Link>
      </div>
    </PageContainer>
  );
}
