"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell } from "recharts";
import { Plus, Megaphone, DollarSign, UserPlus, BarChart3 } from "lucide-react";
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

const LABEL_STATUS: Record<StatusCampanha, { texto: string; cor: string }> = {
  planejada: { texto: "Planejada", cor: "bg-aura-graphite-soft/15 text-aura-graphite-soft" },
  ativa: { texto: "Ativa", cor: "bg-aura-success/10 text-aura-success" },
  pausada: { texto: "Pausada", cor: "bg-aura-warning/10 text-aura-warning" },
  encerrada: { texto: "Encerrada", cor: "bg-aura-graphite-soft/15 text-aura-graphite-soft" },
};

const CORES_BARRA = ["#0f5c5c", "#c9a44c", "#2f8f8f", "#8a6a1c", "#5aa3a3", "#b08a2e"];

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(valor);
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

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-aura-mist bg-white p-4">
          <p className="flex items-center gap-1.5 text-xs text-aura-graphite-soft">
            <Megaphone size={12} />
            Campanhas ativas
          </p>
          <p className="mt-1 font-display text-xl font-bold text-aura-graphite">{ativas}</p>
        </div>
        <div className="rounded-2xl border border-aura-mist bg-white p-4">
          <p className="flex items-center gap-1.5 text-xs text-aura-graphite-soft">
            <UserPlus size={12} />
            Leads gerados (total)
          </p>
          <p className="mt-1 font-display text-xl font-bold text-aura-graphite">{totalLeads}</p>
        </div>
        <div className="rounded-2xl border border-aura-mist bg-white p-4">
          <p className="flex items-center gap-1.5 text-xs text-aura-graphite-soft">
            <DollarSign size={12} />
            Orçamento total
          </p>
          <p className="mt-1 font-display text-xl font-bold text-aura-graphite">{formatarMoeda(totalOrcamento)}</p>
        </div>
      </div>

      {porCanal.length > 0 && (
        <div className="rounded-2xl border border-aura-mist bg-white p-5">
          <p className="flex items-center gap-1.5 text-sm font-medium text-aura-graphite">
            <BarChart3 size={15} className="text-aura-petrol-600" />
            Leads gerados por canal
          </p>
          <div className="mt-3 h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porCanal} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--aura-mist)" vertical={false} />
                <XAxis dataKey="canal" tick={{ fontSize: 10, fill: "var(--aura-graphite-soft)" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--aura-graphite-soft)" }} axisLine={false} tickLine={false} width={24} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: "var(--aura-mist)", fontSize: 12 }} />
                <Bar dataKey="Leads" radius={[6, 6, 0, 0]}>
                  {porCanal.map((_, i) => (
                    <Cell key={i} fill={CORES_BARRA[i % CORES_BARRA.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-aura-mist bg-white p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-medium text-aura-graphite">
            <Megaphone size={15} className="text-aura-petrol-600" />
            Campanhas
          </p>
          {podeGerenciar && (
            <button
              type="button"
              onClick={() => setFormAberto((v) => !v)}
              className="flex items-center gap-1.5 rounded-full bg-aura-petrol-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-aura-petrol-600"
            >
              <Plus size={13} />
              Nova campanha
            </button>
          )}
        </div>

        {formAberto && (
          <form onSubmit={salvarNova} className="mt-4 flex flex-col gap-3 rounded-xl border border-aura-mist bg-aura-bg p-4">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome da campanha"
                className="rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500"
              />
              <input
                type="text"
                value={canalInput}
                onChange={(e) => setCanalInput(e.target.value)}
                placeholder="Canal (Instagram, Google Ads, Indicação...)"
                className="rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500"
              />
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500"
              />
              <input
                type="number"
                min={0}
                value={orcamento}
                onChange={(e) => setOrcamento(e.target.value)}
                placeholder="Orçamento (R$)"
                className="rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500"
              />
            </div>
            <button
              type="submit"
              disabled={salvando}
              className="self-start rounded-lg bg-aura-petrol-700 px-4 py-2 text-xs font-medium text-white hover:bg-aura-petrol-600 disabled:opacity-60"
            >
              {salvando ? "Salvando..." : "Criar campanha"}
            </button>
          </form>
        )}

        {carregando ? (
          <p className="mt-4 text-center text-sm text-aura-graphite-soft">Carregando...</p>
        ) : campanhas.length === 0 ? (
          <p className="mt-4 text-center text-sm text-aura-graphite-soft">Nenhuma campanha cadastrada ainda.</p>
        ) : (
          <ul className="mt-4 flex flex-col divide-y divide-aura-mist">
            {campanhas.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-aura-graphite">{c.nome}</p>
                    <p className="text-xs text-aura-graphite-soft">
                      {c.canal}
                      {c.orcamento ? ` · ${formatarMoeda(c.orcamento)}` : ""}
                      {c.dataInicio ? ` · desde ${c.dataInicio.split("-").reverse().join("/")}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${LABEL_STATUS[c.status].cor}`}>
                    {LABEL_STATUS[c.status].texto}
                  </span>
                </div>

                {podeGerenciar ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-aura-graphite-soft">
                      Leads gerados:
                      <input
                        type="number"
                        min={0}
                        defaultValue={c.leadsGerados}
                        onBlur={(e) => atualizarLeadsGerados(c, e.target.value)}
                        className="w-16 rounded-md border border-aura-mist bg-white px-1.5 py-1 text-center text-xs text-aura-graphite outline-none focus:border-aura-petrol-500"
                      />
                    </label>
                    <select
                      value={c.status}
                      onChange={(e) => mudarStatus(c, e.target.value as StatusCampanha)}
                      className="rounded-md border border-aura-mist bg-white px-2 py-1 text-xs text-aura-graphite outline-none focus:border-aura-petrol-500"
                    >
                      {Object.keys(LABEL_STATUS).map((s) => (
                        <option key={s} value={s}>
                          {LABEL_STATUS[s as StatusCampanha].texto}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => excluir(c.id)}
                      className="ml-auto text-[0.65rem] text-aura-graphite-soft hover:text-aura-danger"
                    >
                      Excluir
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-aura-graphite-soft">Leads gerados: {c.leadsGerados}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
