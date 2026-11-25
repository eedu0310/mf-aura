"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Plus, Megaphone, DollarSign, UserPlus, BarChart3, Trophy, Trash2, X } from "lucide-react";
import {
  listarCampanhas,
  criarCampanha,
  atualizarCampanha,
  apagarCampanha,
  type Campanha,
  type StatusCampanha,
} from "@/lib/supabase/campanhas-marketing";
import { useUserProfile } from "@/lib/user-profile-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { LeadsPorVendedor } from "@/components/marketing/leads-por-vendedor";
import { STATUS_CAMPANHA, dataCurta, moeda } from "@/components/marketing/rotulos";
import { Botao, Card, CardHeader, EstadoVazio, Segmentado, Selo, StatCard } from "@/components/ui";

type FiltroStatus = "todas" | StatusCampanha;

/** Ordem em que as campanhas aparecem: o que está rodando primeiro. */
const ORDEM_STATUS: Record<StatusCampanha, number> = { ativa: 0, planejada: 1, pausada: 2, encerrada: 3 };

function periodo(c: Campanha) {
  if (c.dataInicio && c.dataFim) return `${dataCurta(c.dataInicio)} a ${dataCurta(c.dataFim)}`;
  if (c.dataInicio) return `Desde ${dataCurta(c.dataInicio)}`;
  if (c.dataFim) return `Até ${dataCurta(c.dataFim)}`;
  return "Sem data definida";
}

function Metrica({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[0.68rem] uppercase tracking-wide text-aura-graphite-soft">{rotulo}</p>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-aura-graphite">{valor}</p>
    </div>
  );
}

export function CampanhasMarketing() {
  const { profile } = useUserProfile();
  const podeGerenciar = profile.cargo === "Marketing" || profile.cargo === "Gestor";

  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [formAberto, setFormAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [canalInput, setCanalInput] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [orcamento, setOrcamento] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [filtro, setFiltro] = useState<FiltroStatus>("todas");

  async function carregar() {
    const lista = await listarCampanhas();
    setCampanhas(lista);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const canalRealtime = supabase
      .channel("aura-campanhas-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "campanhas_marketing" }, () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canalRealtime);
    };
  }, []);

  async function salvarNova(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !canalInput.trim()) return;
    setSalvando(true);
    await criarCampanha({
      empresa: profile.empresa,
      nome: nome.trim(),
      canal: canalInput.trim(),
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
      orcamento: orcamento ? Number(orcamento) : undefined,
    });
    setNome("");
    setCanalInput("");
    setDataInicio("");
    setDataFim("");
    setOrcamento("");
    setSalvando(false);
    setFormAberto(false);
  }

  async function mudarStatus(c: Campanha, status: StatusCampanha) {
    await atualizarCampanha(c.id, { status });
  }

  async function atualizarLeadsGerados(c: Campanha, valor: string) {
    const numero = Number(valor) || 0;
    await atualizarCampanha(c.id, { leadsGerados: numero });
  }

  async function excluir(id: string) {
    if (!confirm("Excluir essa campanha?")) return;
    await apagarCampanha(id);
  }

  const ativas = campanhas.filter((c) => c.status === "ativa").length;
  const totalLeads = campanhas.reduce((s, c) => s + c.leadsGerados, 0);
  const totalFechadas = campanhas.reduce((s, c) => s + c.vendasFechadas, 0);
  const totalValor = campanhas.reduce((s, c) => s + c.valorGerado, 0);
  const totalOrcamento = campanhas.reduce((s, c) => s + (c.orcamento ?? 0), 0);

  const porCanal = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const c of campanhas) {
      mapa.set(c.canal, (mapa.get(c.canal) ?? 0) + c.leadsGerados);
    }
    return [...mapa.entries()]
      .map(([canal, leads]) => ({ canal, Leads: leads }))
      .sort((a, b) => b.Leads - a.Leads)
      .slice(0, 6);
  }, [campanhas]);

  const contagem = (s: StatusCampanha) => campanhas.filter((c) => c.status === s).length;

  const exibidas = useMemo(
    () =>
      campanhas
        .filter((c) => filtro === "todas" || c.status === filtro)
        .sort((a, b) => ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status]),
    [campanhas, filtro],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard rotulo="Campanhas ativas" valor={ativas} icone={Megaphone} detalhe={`${campanhas.length} cadastradas`} />
        <StatCard rotulo="Leads gerados" valor={totalLeads} icone={UserPlus} tom="marca" />
        <StatCard
          rotulo="Vendas fechadas"
          valor={totalFechadas}
          icone={Trophy}
          tom="sucesso"
          detalhe={totalValor > 0 ? `${moeda(totalValor)} gerados` : undefined}
        />
        <StatCard rotulo="Orçamento total" valor={moeda(totalOrcamento)} icone={DollarSign} />
      </div>

      {/* Lista de campanhas */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmentado
            rotulo="Filtrar campanhas por situação"
            valor={filtro}
            aoMudar={setFiltro}
            opcoes={[
              { valor: "todas", rotulo: "Todas", contagem: campanhas.length },
              { valor: "ativa", rotulo: "Ativas", contagem: contagem("ativa") },
              { valor: "planejada", rotulo: "Planejadas", contagem: contagem("planejada") },
              { valor: "pausada", rotulo: "Pausadas", contagem: contagem("pausada") },
              { valor: "encerrada", rotulo: "Encerradas", contagem: contagem("encerrada") },
            ]}
          />
          {podeGerenciar && (
            <Botao
              variante={formAberto ? "secundario" : "primario"}
              tamanho="sm"
              icone={formAberto ? X : Plus}
              onClick={() => setFormAberto((v) => !v)}
            >
              {formAberto ? "Cancelar" : "Nova campanha"}
            </Botao>
          )}
        </div>

        {formAberto && (
          <Card>
            <CardHeader titulo="Nova campanha" descricao="Nome e canal são obrigatórios; o resto pode ficar para depois." icone={Plus} />
            <form onSubmit={salvarNova} className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="aura-label">Nome da campanha</span>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex.: Inverno 2026"
                    className="aura-input"
                  />
                </label>
                <label className="block">
                  <span className="aura-label">Canal</span>
                  <input
                    type="text"
                    value={canalInput}
                    onChange={(e) => setCanalInput(e.target.value)}
                    placeholder="Instagram, Google Ads, Indicação..."
                    className="aura-input"
                  />
                </label>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="aura-label">Início</span>
                  <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="aura-input" />
                </label>
                <label className="block">
                  <span className="aura-label">Fim</span>
                  <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="aura-input" />
                </label>
                <label className="block">
                  <span className="aura-label">Orçamento (R$)</span>
                  <input
                    type="number"
                    min={0}
                    value={orcamento}
                    onChange={(e) => setOrcamento(e.target.value)}
                    placeholder="0"
                    className="aura-input"
                  />
                </label>
              </div>
              <Botao type="submit" variante="primario" disabled={salvando} className="self-start">
                {salvando ? "Salvando..." : "Criar campanha"}
              </Botao>
            </form>
          </Card>
        )}

        {carregando ? (
          <div className="aura-card p-8 text-center text-sm text-aura-graphite-soft">Carregando...</div>
        ) : campanhas.length === 0 ? (
          <EstadoVazio
            icone={Megaphone}
            titulo="Nenhuma campanha cadastrada ainda"
            descricao="Cadastre as campanhas e anúncios para acompanhar quantos leads e vendas cada uma traz."
          />
        ) : exibidas.length === 0 ? (
          <EstadoVazio titulo="Nenhuma campanha nessa situação" />
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {exibidas.map((c) => {
              const status = STATUS_CAMPANHA[c.status];
              const conversao = c.leadsGerados > 0 ? Math.round((c.vendasFechadas / c.leadsGerados) * 100) : 0;
              return (
                <li key={c.id} className="aura-card flex flex-col">
                  <div className="flex items-start justify-between gap-3 p-4 pb-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-aura-graphite">{c.nome}</p>
                      <p className="mt-0.5 truncate text-xs text-aura-graphite-soft">
                        {c.canal} · {periodo(c)}
                      </p>
                    </div>
                    <Selo tom={status.tom} className="shrink-0">
                      {status.texto}
                    </Selo>
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-t border-aura-mist px-4 py-3 sm:grid-cols-4">
                    <Metrica rotulo="Leads" valor={c.leadsGerados} />
                    <Metrica rotulo="Fechadas" valor={c.vendasFechadas} />
                    <Metrica rotulo="Conversão" valor={`${conversao}%`} />
                    <Metrica rotulo="Gerou" valor={c.valorGerado > 0 ? moeda(c.valorGerado) : "—"} />
                  </div>

                  <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-aura-mist bg-aura-sunken/40 px-4 py-2.5 text-xs text-aura-graphite-soft">
                    <span>Orçamento: {c.orcamento ? moeda(c.orcamento) : "—"}</span>
                    {podeGerenciar ? (
                      <div className="ml-auto flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-1.5" title="Número anotado à mão (o total acima é contado sozinho)">
                          Leads (manual)
                          <input
                            type="number"
                            min={0}
                            defaultValue={c.leadsGerados}
                            onBlur={(e) => atualizarLeadsGerados(c, e.target.value)}
                            className="aura-input h-7 w-16 px-1.5 text-center text-xs"
                          />
                        </label>
                        <label className="sr-only" htmlFor={`status-${c.id}`}>
                          Situação da campanha
                        </label>
                        <select
                          id={`status-${c.id}`}
                          value={c.status}
                          onChange={(e) => mudarStatus(c, e.target.value as StatusCampanha)}
                          className="aura-input h-7 w-auto px-2 text-xs"
                        >
                          {(Object.keys(STATUS_CAMPANHA) as StatusCampanha[]).map((s) => (
                            <option key={s} value={s}>
                              {STATUS_CAMPANHA[s].texto}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => excluir(c.id)}
                          aria-label={`Excluir a campanha ${c.nome}`}
                          title="Excluir campanha"
                          className="rounded-md p-1.5 text-aura-graphite-soft transition hover:bg-aura-danger/10 hover:text-aura-danger"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Análises: canal e vendedor */}
      <div className="grid grid-cols-1 gap-4">
        {porCanal.length > 0 && (
          <Card>
            <CardHeader titulo="Leads gerados por canal" descricao="Soma dos leads de todas as campanhas de cada canal." icone={BarChart3} />
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porCanal} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--aura-mist)" vertical={false} />
                  <XAxis dataKey="canal" tick={{ fontSize: 10, fill: "var(--aura-graphite-soft)" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--aura-graphite-soft)" }} axisLine={false} tickLine={false} width={24} />
                  <Tooltip
                    cursor={{ fill: "var(--aura-sunken)" }}
                    contentStyle={{
                      borderRadius: 8,
                      borderColor: "var(--aura-mist)",
                      background: "var(--aura-surface)",
                      color: "var(--aura-graphite)",
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "var(--aura-graphite-soft)" }}
                    itemStyle={{ color: "var(--aura-graphite)" }}
                  />
                  <Bar dataKey="Leads" fill="var(--aura-petrol-500)" radius={[4, 4, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        <LeadsPorVendedor />
      </div>
    </div>
  );
}
