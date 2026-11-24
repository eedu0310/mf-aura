"use client";

import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertOctagon, AlertTriangle, CheckCircle2, Flame, Loader2, MessageCircle, Store } from "lucide-react";
import { AuraInsightCard } from "./aura-insight-card";
import { MateriaisAura } from "./materiais-aura";
import { ResumoExecutivoIA } from "@/components/gestor/resumo-executivo-ia";
import { Alerta, Segmentado, Selo, StatCard } from "@/components/ui";

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
  critico: { rotulo: "Crítico", icone: <AlertOctagon className="h-3 w-3" />, tom: "perigo" as const },
  atencao: { rotulo: "Atenção", icone: <AlertTriangle className="h-3 w-3" />, tom: "atencao" as const },
  bom: { rotulo: "Em dia", icone: <CheckCircle2 className="h-3 w-3" />, tom: "sucesso" as const },
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
        <Store size={15} className="text-aura-graphite-soft" />
        <Segmentado
          rotulo="Filtrar por loja"
          opcoes={["", ...(dados?.lojas ?? [])].map((l) => ({ valor: l, rotulo: l || "Todas as lojas" }))}
          valor={loja}
          aoMudar={setLoja}
        />
        {carregando && <Loader2 size={15} className="animate-spin text-aura-graphite-soft" />}
      </div>

      <AuraInsightCard pagina="gestor" loja={loja || undefined} />

      {/* Resumo executivo por escrito: existia no sistema, mas não tinha botão. */}
      <ResumoExecutivoIA />

      {erro && <Alerta tom="perigo" titulo={erro} />}

      {dados && (
        <>
          {/* Equipe */}
          <div className="aura-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-aura-mist px-5 py-3">
              <h3 className="text-sm font-semibold text-aura-graphite">Equipe agora</h3>
              <p className="text-xs text-aura-graphite-soft">
                {dados.vendedores.filter((v) => v.status === "critico").length} crítico(s) ·{" "}
                {dados.vendedores.filter((v) => v.status === "atencao").length} em atenção
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="aura-tabela min-w-[760px]">
                <thead>
                  <tr>
                    <th className="!px-5">Vendedor</th>
                    <th>Status</th>
                    <th className="!text-right">Vendido mês</th>
                    <th>Meta</th>
                    <th className="!text-right">Ativ. semana</th>
                    <th className="!text-right">WhatsApp esperando</th>
                    <th className="!text-right">Follow-ups atrasados</th>
                    <th className="!px-5 !text-right">Negócios parados</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.vendedores.map((v) => {
                    const st = STATUS[v.status];
                    return (
                      <tr key={v.id}>
                        <td className="px-5 py-3">
                          <p className="font-medium text-aura-graphite">{v.nome}</p>
                          <p className="text-xs text-aura-graphite-soft">
                            {v.loja}
                            {v.diasSemAtividade == null ? " · sem atividades" : v.diasSemAtividade >= 2 ? ` · ${v.diasSemAtividade} dias sem atividade` : ""}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <Selo tom={st.tom}>
                            {st.icone}
                            {st.rotulo}
                          </Selo>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums text-aura-graphite">{moeda(v.vendidoMes)}</td>
                        <td className="px-3 py-3">
                          {v.pctMeta != null ? (
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-20 rounded-full bg-aura-sunken">
                                <div
                                  className={`h-1.5 rounded-full ${v.pctMeta >= 100 ? "bg-aura-success" : v.pctMeta >= 60 ? "bg-aura-warning" : "bg-aura-danger"}`}
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
                        <td className={`px-3 py-3 text-right tabular-nums ${v.whatsEsperando ? "font-semibold !text-aura-danger" : ""}`}>{v.whatsEsperando}</td>
                        <td className={`px-3 py-3 text-right tabular-nums ${v.followupsVencidos ? "font-semibold !text-aura-gold-700" : ""}`}>{v.followupsVencidos}</td>
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
            <div className="aura-card p-5">
              <h3 className="mb-3 flex items-center gap-2.5 text-sm font-semibold text-aura-graphite">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-aura-danger/10">
                  <Flame size={15} className="text-aura-danger" />
                </span>
                Leads em risco <span className="font-normal tabular-nums text-aura-graphite-soft">({dados.leadsEmRisco.length})</span>
              </h3>
              {dados.leadsEmRisco.length ? (
                <ul className="divide-y divide-aura-mist">
                  {dados.leadsEmRisco.map((l, i) => (
                    <li key={i} className="flex items-start gap-3 py-2.5">
                      {l.origem === "WhatsApp" ? (
                        <MessageCircle size={15} className="mt-0.5 shrink-0 text-aura-success" />
                      ) : (
                        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-aura-warning" />
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
                <p className="py-8 text-center text-sm text-aura-graphite-soft">Nenhum lead em risco agora.</p>
              )}
            </div>

            {/* Lojas */}
            <div className="aura-card p-5">
              <h3 className="mb-3 text-sm font-semibold text-aura-graphite">Vendido nos últimos 30 dias por loja</h3>
              <div style={{ height: Math.max(140, dados.porLoja.length * 48) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dados.porLoja} layout="vertical" margin={{ top: 0, right: 80, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="loja" width={130} tick={{ fontSize: 12, fill: "var(--aura-graphite)" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: "var(--aura-sunken)" }}
                      content={({ active, payload }: any) =>
                        active && payload?.length ? (
                          <div className="rounded-lg border border-aura-mist bg-aura-surface px-3 py-2 text-xs text-aura-graphite-soft shadow-lg">
                            <p className="font-medium text-aura-graphite">{payload[0].payload.loja}</p>
                            <p>{moeda(payload[0].payload.vendido)} · {payload[0].payload.vendas} venda(s)</p>
                            <p>{payload[0].payload.atividades} atividades · {payload[0].payload.clientes} clientes</p>
                            <p>Pipeline {moeda(payload[0].payload.pipeline)}</p>
                          </div>
                        ) : null
                      }
                    />
                    <Bar dataKey="vendido" fill="var(--aura-petrol-500)" radius={[0, 4, 4, 0]} maxBarSize={22}>
                      <LabelList dataKey="vendido" position="right" formatter={(v: any) => moedaCurta(Number(v))} style={{ fontSize: 12, fill: "var(--aura-graphite-soft)" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <StatCard className="!p-3 shadow-none [&>p:last-child]:text-lg" rotulo="Pipeline aberto" valor={moedaCurta(dados.kpis.pipelineAberto)} />
                <StatCard className="!p-3 shadow-none [&>p:last-child]:text-lg" rotulo="Atividades (30d)" valor={dados.kpis.atividades} />
                <StatCard className="!p-3 shadow-none [&>p:last-child]:text-lg" rotulo="Conversão" valor={dados.kpis.conversao != null ? `${dados.kpis.conversao}%` : "—"} />
              </div>
            </div>
          </div>

          <MateriaisAura loja={loja || undefined} />
        </>
      )}
    </div>
  );
}
