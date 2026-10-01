"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, DollarSign, Loader2, Percent, Printer, Receipt, Sparkles, Target, Users } from "lucide-react";

// Paleta validada (dataviz): uma cor por gráfico, texto sempre em tinta neutra.
const COR = { serie: "#2a78d6", serie2: "#1baf7a", grade: "#e7e5e4", texto: "#52514e", tinta: "#0b0b0b" };
const COR_ETAPA: Record<string, string> = {
  Prospecção: "#94a3b8",
  Apresentação: "#2a78d6",
  Proposta: "#eda100",
  Negociação: "#eb6834",
  Fechados: "#1baf7a",
  Perdidos: "#e34948",
};

interface Relatorio {
  periodoDias: number;
  kpis: { vendido: number; qtdVendas: number; ticket: number; atividades: number; novosClientes: number; conversao: number | null; pipelineAberto: number };
  vendasPorDia: { dia: string; valor: number }[];
  atividadesPorDia: { dia: string; qtd: number }[];
  atividadesPorTipo: { tipo: string; qtd: number }[];
  funil: { etapa: string; qtd: number; valor: number }[];
  porVendedor: { id: string; nome: string; loja: string; vendido: number; vendas: number; atividades: number; pipeline: number; leads: number; fechadas: number; perdidas: number }[];
  porLoja: { loja: string; vendido: number; vendas: number; atividades: number; pipeline: number; clientes: number }[];
  topClientes: { cliente: string; valor: number }[];
}

interface Resposta {
  relatorio: Relatorio;
  aura: { manchete: string; foco: string; insights: { tipo: string; titulo: string; detalhe?: string }[]; fonte: string };
  gestor: boolean;
  filtros: { lojas: string[]; vendedores: { id: string; nome: string; loja: string }[] } | null;
}

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const moedaCurta = (v: number) =>
  v >= 1_000_000 ? `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")} mi` : v >= 1000 ? `R$ ${Math.round(v / 1000)} mil` : `R$ ${Math.round(v)}`;
const diaCurto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function Numero({ icone, label, valor, sub }: { icone: React.ReactNode; label: string; valor: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-aura-mist bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-aura-graphite-soft">
        {icone}
        {label}
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums text-aura-graphite">{valor}</p>
      {sub && <p className="mt-1 text-xs text-aura-graphite-soft">{sub}</p>}
    </div>
  );
}

function Cartao({ titulo, children, className = "" }: { titulo: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-aura-mist bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      <h3 className="mb-3 text-sm font-semibold text-aura-graphite">{titulo}</h3>
      {children}
    </div>
  );
}

function Dica({ active, payload, label, formato }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-aura-mist bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-aura-graphite">{/^\d{4}-\d{2}-\d{2}$/.test(String(label)) ? diaCurto(String(label)) : label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-aura-graphite-soft">
          {formato ? formato(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

/** Relatório visual: números grandes + gráficos + recado curto da AURA. */
export function RelatorioVisual() {
  const [dias, setDias] = useState(30);
  const [loja, setLoja] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [dados, setDados] = useState<Resposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const qs = new URLSearchParams({ dias: String(dias) });
      if (loja) qs.set("loja", loja);
      if (vendedor) qs.set("vendedor", vendedor);
      const res = await fetch(`/api/aura/relatorio?${qs}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao gerar relatório");
      setDados(json);
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao gerar relatório");
    } finally {
      setCarregando(false);
    }
  }, [dias, loja, vendedor]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const r = dados?.relatorio;
  const vendedoresFiltro = useMemo(
    () => (dados?.filtros?.vendedores ?? []).filter((v) => !loja || v.loja === loja),
    [dados, loja],
  );
  const funilAberto = r?.funil.filter((f) => f.etapa !== "Perdidos") ?? [];
  const maxFunil = Math.max(1, ...funilAberto.map((f) => f.qtd));
  const passo = r ? Math.max(1, Math.ceil(r.vendasPorDia.length / 10)) : 1;

  return (
    <div className="space-y-5">
      {/* Filtros numa linha só */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <div className="flex rounded-full border border-aura-mist bg-white p-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDias(d)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${dias === d ? "bg-aura-navy-950 text-aura-gold" : "text-aura-graphite-soft hover:text-aura-graphite"}`}
            >
              {d} dias
            </button>
          ))}
        </div>
        {dados?.gestor && dados.filtros && (
          <>
            <select
              value={loja}
              onChange={(e) => {
                setLoja(e.target.value);
                setVendedor("");
              }}
              className="rounded-full border border-aura-mist bg-white px-4 py-2 text-sm text-aura-graphite"
            >
              <option value="">Todas as lojas</option>
              {dados.filtros.lojas.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <select value={vendedor} onChange={(e) => setVendedor(e.target.value)} className="rounded-full border border-aura-mist bg-white px-4 py-2 text-sm text-aura-graphite">
              <option value="">Todos os vendedores</option>
              {vendedoresFiltro.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome}
                </option>
              ))}
            </select>
          </>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 rounded-full border border-aura-mist bg-white px-4 py-2 text-sm text-aura-graphite hover:bg-aura-bg"
        >
          <Printer className="h-4 w-4" /> Imprimir / PDF
        </button>
      </div>

      {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
      {carregando && !r && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-aura-petrol-500" />
        </div>
      )}

      {r && (
        <div className={`space-y-5 transition ${carregando ? "opacity-60" : ""}`}>
          {/* Recado da AURA — curto */}
          {dados?.aura && (
            <div className="flex items-start gap-3 rounded-2xl bg-aura-navy-950 px-5 py-4 text-white">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-aura-gold" />
              <div className="min-w-0">
                <p className="text-lg font-semibold">{dados.aura.manchete}</p>
                <p className="text-sm text-white/75">{dados.aura.foco}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {dados.aura.insights.slice(0, 3).map((i, k) => (
                    <span key={k} className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/90">
                      {i.titulo}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Números grandes */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Numero icone={<DollarSign className="h-4 w-4" />} label="Vendido" valor={moedaCurta(r.kpis.vendido)} sub={`${r.kpis.qtdVendas} venda(s)`} />
            <Numero icone={<Receipt className="h-4 w-4" />} label="Ticket médio" valor={moedaCurta(r.kpis.ticket)} />
            <Numero icone={<Activity className="h-4 w-4" />} label="Atividades" valor={String(r.kpis.atividades)} sub={`${(r.kpis.atividades / r.periodoDias).toFixed(1).replace(".", ",")} por dia`} />
            <Numero
              icone={<Percent className="h-4 w-4" />}
              label="Conversão"
              valor={r.kpis.conversao != null ? `${r.kpis.conversao}%` : "—"}
              sub="fechados ÷ (fechados + perdidos)"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {/* Vendas por dia */}
            <Cartao titulo={`Vendas por dia (${moeda(r.kpis.vendido)})`} className="lg:col-span-2">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={r.vendasPorDia} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gVendas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COR.serie} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={COR.serie} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke={COR.grade} />
                    <XAxis dataKey="dia" tickFormatter={diaCurto} interval={passo - 1} tick={{ fontSize: 11, fill: COR.texto }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={moedaCurta} width={70} tick={{ fontSize: 11, fill: COR.texto }} axisLine={false} tickLine={false} />
                    <Tooltip content={<Dica formato={moeda} />} />
                    <Area type="monotone" dataKey="valor" stroke={COR.serie} strokeWidth={2} fill="url(#gVendas)" activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Cartao>

            {/* Funil */}
            <Cartao titulo="Funil de vendas (negócios)">
              <div className="space-y-2.5">
                {funilAberto.map((f) => (
                  <div key={f.etapa} title={`${f.qtd} negócio(s) · ${moeda(f.valor)}`}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium text-aura-graphite">{f.etapa}</span>
                      <span className="tabular-nums text-aura-graphite-soft">
                        {f.qtd} · {moedaCurta(f.valor)}
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-100">
                      <div
                        className="h-3 rounded-full"
                        style={{ width: `${Math.max(3, (f.qtd / maxFunil) * 100)}%`, backgroundColor: COR_ETAPA[f.etapa] }}
                      />
                    </div>
                  </div>
                ))}
                <p className="pt-1 text-xs text-aura-graphite-soft">
                  Em aberto: <strong className="text-aura-graphite">{moeda(r.kpis.pipelineAberto)}</strong>
                  {r.funil.find((f) => f.etapa === "Perdidos")?.qtd ? ` · ${r.funil.find((f) => f.etapa === "Perdidos")!.qtd} perdido(s)` : ""}
                </p>
              </div>
            </Cartao>

            {/* Atividades por dia */}
            <Cartao titulo={`Atividades por dia (${r.kpis.atividades})`} className="lg:col-span-2">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={r.atividadesPorDia} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={COR.grade} />
                    <XAxis dataKey="dia" tickFormatter={diaCurto} interval={passo - 1} tick={{ fontSize: 11, fill: COR.texto }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} width={30} tick={{ fontSize: 11, fill: COR.texto }} axisLine={false} tickLine={false} />
                    <Tooltip content={<Dica formato={(v: number) => `${v} atividade(s)`} />} cursor={{ fill: "#f5f5f4" }} />
                    <Bar dataKey="qtd" fill={COR.serie2} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Cartao>

            {/* Atividades por tipo */}
            <Cartao titulo="O que mais foi feito">
              {r.atividadesPorTipo.length ? (
                <div style={{ height: Math.max(160, r.atividadesPorTipo.length * 34) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={r.atividadesPorTipo} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                      <XAxis type="number" hide allowDecimals={false} />
                      <YAxis type="category" dataKey="tipo" width={90} tick={{ fontSize: 12, fill: COR.tinta }} axisLine={false} tickLine={false} />
                      <Tooltip content={<Dica formato={(v: number) => `${v} atividade(s)`} />} cursor={{ fill: "#f5f5f4" }} />
                      <Bar dataKey="qtd" fill={COR.serie} radius={[0, 4, 4, 0]} maxBarSize={20}>
                        <LabelList dataKey="qtd" position="right" style={{ fontSize: 12, fill: COR.texto }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-aura-graphite-soft">Nenhuma atividade no período.</p>
              )}
            </Cartao>
          </div>

          {/* Comparativos (gestor ou visão geral) */}
          {dados?.gestor && r.porLoja.length > 1 && !loja && (
            <Cartao titulo="Comparativo por loja">
              <div className="grid gap-3 sm:grid-cols-2">
                {r.porLoja.map((l) => (
                  <div key={l.loja} className="rounded-xl border border-aura-mist p-4">
                    <p className="font-semibold text-aura-graphite">{l.loja}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                      <div><p className="text-xs text-aura-graphite-soft">Vendido</p><p className="font-bold tabular-nums">{moedaCurta(l.vendido)}</p></div>
                      <div><p className="text-xs text-aura-graphite-soft">Vendas</p><p className="font-bold tabular-nums">{l.vendas}</p></div>
                      <div><p className="text-xs text-aura-graphite-soft">Atividades</p><p className="font-bold tabular-nums">{l.atividades}</p></div>
                      <div><p className="text-xs text-aura-graphite-soft">Pipeline</p><p className="font-bold tabular-nums">{moedaCurta(l.pipeline)}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </Cartao>
          )}

          {dados?.gestor && r.porVendedor.length > 1 && !vendedor && (
            <Cartao titulo="Vendedores (vendido no período)">
              <div style={{ height: Math.max(180, r.porVendedor.length * 38) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={r.porVendedor} layout="vertical" margin={{ top: 0, right: 80, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="nome" width={130} tick={{ fontSize: 12, fill: COR.tinta }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: "#f5f5f4" }}
                      content={({ active, payload }: any) =>
                        active && payload?.length ? (
                          <div className="rounded-lg border border-aura-mist bg-white px-3 py-2 text-xs shadow-lg">
                            <p className="font-medium text-aura-graphite">{payload[0].payload.nome} · {payload[0].payload.loja}</p>
                            <p className="text-aura-graphite-soft">{moeda(payload[0].payload.vendido)} em {payload[0].payload.vendas} venda(s)</p>
                            <p className="text-aura-graphite-soft">{payload[0].payload.atividades} atividades · pipeline {moeda(payload[0].payload.pipeline)}</p>
                          </div>
                        ) : null
                      }
                    />
                    <Bar dataKey="vendido" fill={COR.serie} radius={[0, 4, 4, 0]} maxBarSize={22}>
                      <LabelList dataKey="vendido" position="right" formatter={(v: any) => moedaCurta(Number(v))} style={{ fontSize: 12, fill: COR.texto }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Cartao>
          )}

          {/* Número por número, por vendedor. O gráfico acima responde "quem
              vendeu mais"; esta tabela responde "quantos leads cada um recebeu
              e o que fez com eles", que é o que o gestor pediu para cobrar. */}
          {dados?.gestor && r.porVendedor.length > 0 && !vendedor && (
            <Cartao titulo="Leads e vendas por vendedor">
              <div className="-mx-2 overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-aura-mist text-left text-xs text-aura-graphite-soft">
                      <th className="px-2 py-2 font-medium">Vendedor</th>
                      <th className="px-2 py-2 font-medium">Loja</th>
                      <th className="px-2 py-2 text-right font-medium">Leads</th>
                      <th className="px-2 py-2 text-right font-medium">Fechou</th>
                      <th className="px-2 py-2 text-right font-medium">Perdeu</th>
                      <th className="px-2 py-2 text-right font-medium">Conversão</th>
                      <th className="px-2 py-2 text-right font-medium">Faturamento</th>
                      <th className="px-2 py-2 text-right font-medium">Pipeline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.porVendedor.map((v) => {
                      // Conversão sobre o que foi decidido (fechou + perdeu), e
                      // não sobre os leads recebidos: lead que ainda está em
                      // negociação não é acerto nem erro, e contá-lo como erro
                      // puniria quem tem muita coisa em aberto.
                      const decididos = v.fechadas + v.perdidas;
                      const conv = decididos
                        ? Math.round((v.fechadas / decididos) * 100)
                        : null;
                      return (
                        <tr key={v.id} className="border-b border-aura-mist/60 last:border-0">
                          <td className="px-2 py-2 font-medium text-aura-graphite">{v.nome}</td>
                          <td className="px-2 py-2 text-aura-graphite-soft">{v.loja}</td>
                          <td className="px-2 py-2 text-right text-aura-graphite">{v.leads}</td>
                          <td className="px-2 py-2 text-right text-aura-success">{v.fechadas}</td>
                          <td className="px-2 py-2 text-right text-aura-danger">{v.perdidas}</td>
                          <td className="px-2 py-2 text-right text-aura-graphite">
                            {conv === null ? "—" : `${conv}%`}
                          </td>
                          <td className="px-2 py-2 text-right font-medium text-aura-graphite">{moeda(v.vendido)}</td>
                          <td className="px-2 py-2 text-right text-aura-graphite-soft">{moeda(v.pipeline)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-aura-graphite-soft">
                Conversão é sobre o que já foi decidido (fechou + perdeu). Quem
                tem muita coisa em aberto não aparece pior por isso. Pipeline
                conta de Proposta em diante.
              </p>
            </Cartao>
          )}

          {/* Top clientes */}
          {r.topClientes.length > 0 && (
            <Cartao titulo="Maiores clientes do período">
              <ol className="space-y-2">
                {r.topClientes.map((c, i) => (
                  <li key={c.cliente} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-aura-navy-950 text-xs font-bold text-aura-gold">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-aura-graphite">{c.cliente}</span>
                    <span className="text-sm font-semibold tabular-nums text-aura-graphite">{moeda(c.valor)}</span>
                  </li>
                ))}
              </ol>
            </Cartao>
          )}

          <p className="flex items-center gap-1.5 text-xs text-aura-graphite-soft">
            <Users className="h-3.5 w-3.5" /> Novos clientes no período: <strong>{r.kpis.novosClientes}</strong>
            <Target className="ml-3 h-3.5 w-3.5" /> Pipeline aberto: <strong>{moeda(r.kpis.pipelineAberto)}</strong>
          </p>
        </div>
      )}
    </div>
  );
}
