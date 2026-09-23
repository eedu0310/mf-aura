"use client";

import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertOctagon, AlertTriangle, CheckCircle2, Flame, Loader2, MessageCircle, Store } from "lucide-react";
import { AuraInsightCard } from "./aura-insight-card";
import { MateriaisAura } from "./materiais-aura";

interface Vendedor {
  id: string;
  nome: string;
  loja: string;
  vendidoMes: number;
  metaMes: number | null;
  pctMeta: number | null;
  atividadesSemana: number;
  followupsVencidos: number;
  paradas: number;
  whatsEsperando: number;
  diasSemAtividade: number | null;
  status: "bom" | "atencao" | "critico";
}

interface Resposta {
  vendedores: Vendedor[];
  leadsEmRisco: { cliente: string; vendedor: string; motivo: string; origem: string }[];
  lojas: string[];
  porLoja: { loja: string; vendido: number; vendas: number; atividades: number; pipeline: number; clientes: number }[];
  funil: { etapa: string; qtd: number; valor: number }[];
  kpis: { vendido: number; qtdVendas: number; ticket: number; atividades: number; pipelineAberto: number; conversao: number | null };
}

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const moedaCurta = (v: number) => (v >= 1000 ? `R$ ${Math.round(v / 1000)} mil` : `R$ ${Math.round(v)}`);

// Status com ícone + texto (nunca só cor).
const STATUS = {
  critico: { rotulo: "Crítico", icone: <AlertOctagon className="h-4 w-4" />, classe: "bg-red-50 text-red-700 border-red-200" },
  atencao: { rotulo: "Atenção", icone: <AlertTriangle className="h-4 w-4" />, classe: "bg-amber-50 text-amber-800 border-amber-200" },
  bom: { rotulo: "Em dia", icone: <CheckCircle2 className="h-4 w-4" />, classe: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

/** Painel do gestor: equipe, riscos e lojas, com a AURA no topo. */
export function GestorPainelAura() {
  const [loja, setLoja] = useState("");
  const [dados, setDados] = useState<Resposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/aura/gestor${loja ? `?loja=${encodeURIComponent(loja)}` : ""}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao carregar");
      setDados(json);
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao carregar");
    } finally {
      setCarregando(false);
    }
  }, [loja]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <div className="space-y-5">
      {/* Filtro de loja */}
      <div className="flex flex-wrap items-center gap-2">
        <Store className="h-4 w-4 text-aura-graphite-soft" />
        {["", ...(dados?.lojas ?? [])].map((l) => (
          <button
            key={l || "todas"}
            type="button"
            onClick={() => setLoja(l)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              loja === l ? "border-aura-navy-950 bg-aura-navy-950 text-aura-gold" : "border-aura-mist bg-white text-aura-graphite hover:bg-aura-bg"
            }`}
          >
            {l || "Todas as lojas"}
          </button>
        ))}
        {carregando && <Loader2 className="h-4 w-4 animate-spin text-aura-petrol-500" />}
      </div>

      <AuraInsightCard pagina="gestor" loja={loja || undefined} />

      {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

      {dados && (
        <>
          {/* Equipe */}
          <div className="rounded-2xl border border-aura-mist bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-aura-mist px-5 py-3">
              <h3 className="text-sm font-semibold text-aura-graphite">Equipe agora</h3>
              <p className="text-xs text-aura-graphite-soft">
                {dados.vendedores.filter((v) => v.status === "critico").length} crítico(s) ·{" "}
                {dados.vendedores.filter((v) => v.status === "atencao").length} em atenção
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-aura-graphite-soft">
                    <th className="px-5 py-2 font-medium">Vendedor</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Vendido mês</th>
                    <th className="px-3 py-2 font-medium">Meta</th>
                    <th className="px-3 py-2 text-right font-medium">Ativ. semana</th>
                    <th className="px-3 py-2 text-right font-medium">WhatsApp esperando</th>
                    <th className="px-3 py-2 text-right font-medium">Follow-ups atrasados</th>
                    <th className="px-5 py-2 text-right font-medium">Negócios parados</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.vendedores.map((v) => {
                    const st = STATUS[v.status];
                    return (
                      <tr key={v.id} className="border-t border-aura-mist/70">
                        <td className="px-5 py-3">
                          <p className="font-medium text-aura-graphite">{v.nome}</p>
                          <p className="text-xs text-aura-graphite-soft">
                            {v.loja}
                            {v.diasSemAtividade == null ? " · sem atividades" : v.diasSemAtividade >= 2 ? ` · ${v.diasSemAtividade} dias sem atividade` : ""}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${st.classe}`}>
                            {st.icone}
                            {st.rotulo}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums text-aura-graphite">{moeda(v.vendidoMes)}</td>
                        <td className="px-3 py-3">
                          {v.pctMeta != null ? (
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-20 rounded-full bg-slate-100">
                                <div
                                  className={`h-2 rounded-full ${v.pctMeta >= 100 ? "bg-emerald-500" : v.pctMeta >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                                  style={{ width: `${Math.min(100, v.pctMeta)}%` }}
                                />
                              </div>
                              <span className="text-xs tabular-nums text-aura-graphite">{v.pctMeta}%</span>
                            </div>
                          ) : (
                            <span className="text-xs text-aura-graphite-soft">sem meta</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{v.atividadesSemana}</td>
                        <td className={`px-3 py-3 text-right tabular-nums ${v.whatsEsperando ? "font-semibold text-red-600" : ""}`}>{v.whatsEsperando}</td>
                        <td className={`px-3 py-3 text-right tabular-nums ${v.followupsVencidos ? "font-semibold text-amber-700" : ""}`}>{v.followupsVencidos}</td>
                        <td className="px-5 py-3 text-right tabular-nums">{v.paradas}</td>
                      </tr>
                    );
                  })}
                  {!dados.vendedores.length && (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-aura-graphite-soft">
                        Nenhum vendedor nesta loja.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Leads em risco */}
            <div className="rounded-2xl border border-aura-mist bg-white p-5 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-aura-graphite">
                <Flame className="h-4 w-4 text-red-500" /> Leads em risco ({dados.leadsEmRisco.length})
              </h3>
              {dados.leadsEmRisco.length ? (
                <ul className="divide-y divide-aura-mist">
                  {dados.leadsEmRisco.map((l, i) => (
                    <li key={i} className="flex items-start gap-3 py-2.5">
                      {l.origem === "WhatsApp" ? (
                        <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-aura-graphite">
                          {l.cliente} <span className="font-normal text-aura-graphite-soft">· {l.vendedor}</span>
                        </p>
                        <p className="text-xs text-aura-graphite-soft">{l.motivo}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-8 text-center text-sm text-aura-graphite-soft">Nenhum lead em risco agora. 👏</p>
              )}
            </div>

            {/* Lojas */}
            <div className="rounded-2xl border border-aura-mist bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-aura-graphite">Vendido nos últimos 30 dias por loja</h3>
              <div style={{ height: Math.max(140, dados.porLoja.length * 48) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dados.porLoja} layout="vertical" margin={{ top: 0, right: 80, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="loja" width={130} tick={{ fontSize: 12, fill: "#0b0b0b" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: "#f5f5f4" }}
                      content={({ active, payload }: any) =>
                        active && payload?.length ? (
                          <div className="rounded-lg border border-aura-mist bg-white px-3 py-2 text-xs shadow-lg">
                            <p className="font-medium">{payload[0].payload.loja}</p>
                            <p>{moeda(payload[0].payload.vendido)} · {payload[0].payload.vendas} venda(s)</p>
                            <p>{payload[0].payload.atividades} atividades · {payload[0].payload.clientes} clientes</p>
                            <p>Pipeline {moeda(payload[0].payload.pipeline)}</p>
                          </div>
                        ) : null
                      }
                    />
                    <Bar dataKey="vendido" fill="#2a78d6" radius={[0, 4, 4, 0]} maxBarSize={26}>
                      <LabelList dataKey="vendido" position="right" formatter={(v: any) => moedaCurta(Number(v))} style={{ fontSize: 12, fill: "#52514e" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-aura-bg p-2">
                  <p className="text-xs text-aura-graphite-soft">Pipeline aberto</p>
                  <p className="font-bold tabular-nums">{moedaCurta(dados.kpis.pipelineAberto)}</p>
                </div>
                <div className="rounded-lg bg-aura-bg p-2">
                  <p className="text-xs text-aura-graphite-soft">Atividades (30d)</p>
                  <p className="font-bold tabular-nums">{dados.kpis.atividades}</p>
                </div>
                <div className="rounded-lg bg-aura-bg p-2">
                  <p className="text-xs text-aura-graphite-soft">Conversão</p>
                  <p className="font-bold tabular-nums">{dados.kpis.conversao != null ? `${dados.kpis.conversao}%` : "—"}</p>
                </div>
              </div>
            </div>
          </div>

          <MateriaisAura loja={loja || undefined} />
        </>
      )}
    </div>
  );
}
