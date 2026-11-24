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
import { Alerta, Segmentado, classeBotao } from "@/components/ui";

// Uma cor por gráfico, texto sempre em tinta neutra. Pelas variáveis do tema,
// para o gráfico acompanhar o claro e o escuro.
const COR = {
  serie: "var(--aura-petrol-500)",
  serie2: "var(--aura-gold)",
  grade: "var(--aura-mist)",
  texto: "var(--aura-graphite-soft)",
  tinta: "var(--aura-graphite)",
  cursor: "var(--aura-sunken)",
};
/*
 * As cores das etapas vêm do funil da loja, junto com os números: era um mapa
 * fixo por nome, e uma etapa renomeada ficava sem cor nenhuma na barra.
 */

interface Relatorio {
  periodoDias: number;
  kpis: { vendido: number; qtdVendas: number; ticket: number; atividades: number; novosClientes: number; conversao: number | null; pipelineAberto: number };
  vendasPorDia: { dia: string; valor: number }[];
  atividadesPorDia: { dia: string; qtd: number }[];
  atividadesPorTipo: { tipo: string; qtd: number }[];
  funil: { etapa: string; qtd: number; valor: number; tipo: string; cor: string }[];
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
    <div data-cartao className="aura-card p-4">
      <div className="flex items-center gap-1.5 text-aura-graphite-soft">
        {icone}
        <span className="aura-rotulo truncate">{label}</span>
      </div>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-aura-graphite">{valor}</p>
      {sub && <p className="mt-1 text-xs text-aura-graphite-soft">{sub}</p>}
    </div>
  );
}

function Cartao({ titulo, children, className = "" }: { titulo: string; children: React.ReactNode; className?: string }) {
  return (
    <div
      data-cartao
      className={`aura-card p-4 sm:p-5 ${className}`}
    >
      <h3 className="mb-3 text-sm font-semibold text-aura-graphite">{titulo}</h3>
      {children}
    </div>
  );
}

/**
 * O cabeçalho que só existe no papel.
 *
 * Na tela, o período e os filtros estão nos botões no alto — e esses botões
 * não vão para a impressão. O resultado era uma folha cheia de números sem
 * dizer de QUE período eram, de qual loja, nem quem tirou. Um relatório
 * assim não serve para levar a uma reunião: ninguém consegue conferir depois.
 */
function CabecalhoImpressao({
  dias,
  loja,
  vendedor,
}: {
  dias: number;
  loja: string;
  vendedor: string;
}) {
  const fim = new Date();
  const inicio = new Date(fim.getTime() - (dias - 1) * 86400000);
  const data = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <header className="hidden print:block" data-cabecalho-impressao>
      <div className="flex items-end justify-between border-b-2 border-aura-navy-950 pb-2">
        <div>
          <p className="font-display text-xl font-semibold text-aura-graphite">
            Relatório comercial
          </p>
          <p className="text-[11px] text-aura-graphite-soft">AURA · Grupo MF</p>
        </div>
        <div className="text-right text-[11px] text-aura-graphite-soft">
          <p>
            <strong className="text-aura-graphite">Período:</strong> {data(inicio)} a {data(fim)}{" "}
            ({dias} dias)
          </p>
          <p>
            <strong className="text-aura-graphite">Loja:</strong> {loja || "todas"} ·{" "}
            <strong className="text-aura-graphite">Vendedor:</strong> {vendedor ? "filtrado" : "todos"}
          </p>
          <p>
            Emitido em{" "}
            {new Date().toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
    </header>
  );
}

function Dica({ active, payload, label, formato }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-aura-mist bg-aura-surface px-3 py-2 text-xs shadow-lg">
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
  const [preparandoImpressao, setPreparandoImpressao] = useState(false);

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
  const funilAberto = r?.funil.filter((f) => f.tipo !== "perda") ?? [];
  const maxFunil = Math.max(1, ...funilAberto.map((f) => f.qtd));
  const passo = r ? Math.max(1, Math.ceil(r.vendasPorDia.length / 10)) : 1;


  /**
   * Imprimir, esperando os gráficos se redesenharem.
   *
   * O Recharts desenha o SVG no tamanho que o container tinha NA HORA. Numa
   * tela de 1400px ele desenha 1100px de largura; a folha A4 tem 186mm úteis,
   * e o gráfico saía cortado na margem direita. Então a área encolhe para a
   * largura da folha, esperamos o redesenho, e só aí a janela de impressão
   * abre. Sem a espera, imprime o desenho antigo.
   */
  async function imprimir() {
    setPreparandoImpressao(true);
    // Dois quadros para o React aplicar a classe, mais a folga que o Recharts
    // usa para remedir o container e refazer o SVG.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
    await new Promise((r) => setTimeout(r, 400));
    try {
      window.print();
    } finally {
      setPreparandoImpressao(false);
    }
  }

  return (
    <div className={`space-y-5 ${preparandoImpressao ? "modo-impressao" : ""}`}>
      {/* Filtros numa linha só */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Segmentado
          rotulo="Período"
          opcoes={[7, 30, 90].map((d) => ({ valor: String(d), rotulo: `${d} dias` }))}
          valor={String(dias)}
          aoMudar={(v) => setDias(Number(v))}
        />
        {dados?.gestor && dados.filtros && (
          <>
            <select
              value={loja}
              onChange={(e) => {
                setLoja(e.target.value);
                setVendedor("");
              }}
              className="aura-input !h-9 w-auto"
            >
              <option value="">Todas as lojas</option>
              {dados.filtros.lojas.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <select value={vendedor} onChange={(e) => setVendedor(e.target.value)} className="aura-input !h-9 w-auto">
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
          onClick={imprimir}
          disabled={preparandoImpressao || !r}
          className={classeBotao("secundario", "md", "ml-auto")}
        >
          {preparandoImpressao ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Printer size={15} />
          )}
          Imprimir / PDF
        </button>
      </div>

      {erro && <Alerta tom="perigo" titulo={erro} />}
      {carregando && !r && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-aura-graphite-soft" />
        </div>
      )}

      {r && (
        <div className={`space-y-5 transition ${carregando ? "opacity-60" : ""}`}>
          <CabecalhoImpressao dias={dias} loja={loja} vendedor={vendedor} />
          {/* Recado da AURA — curto */}
          {dados?.aura && (
            <div
              data-cartao
              data-imprimir="clarear"
              className="aura-card flex items-start gap-3 px-5 py-4"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aura-gold/15 ring-1 ring-inset ring-aura-gold/25">
                <Sparkles size={16} className="text-aura-gold-700" />
              </span>
              <div className="min-w-0">
                <p className="aura-rotulo">Supervisora AURA</p>
                <p className="mt-0.5 text-[0.9375rem] font-semibold text-aura-graphite">{dados.aura.manchete}</p>
                <p className="mt-0.5 text-sm text-aura-graphite-soft">{dados.aura.foco}</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {dados.aura.insights.slice(0, 3).map((i, k) => (
                    <span key={k} data-chip className="rounded-md border border-aura-mist bg-aura-sunken px-2 py-1 text-xs text-aura-graphite">
                      {i.titulo}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Números grandes */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 print:grid-cols-4 print:gap-2">
            <Numero icone={<DollarSign size={13} />} label="Vendido" valor={moedaCurta(r.kpis.vendido)} sub={`${r.kpis.qtdVendas} venda(s)`} />
            <Numero icone={<Receipt size={13} />} label="Ticket médio" valor={moedaCurta(r.kpis.ticket)} />
            <Numero icone={<Activity size={13} />} label="Atividades" valor={String(r.kpis.atividades)} sub={`${(r.kpis.atividades / r.periodoDias).toFixed(1).replace(".", ",")} por dia`} />
            <Numero
              icone={<Percent size={13} />}
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
                    <div className="h-2 rounded-full bg-aura-sunken">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${Math.max(3, (f.qtd / maxFunil) * 100)}%`, backgroundColor: f.cor }}
                      />
                    </div>
                  </div>
                ))}
                <p className="pt-1 text-xs text-aura-graphite-soft">
                  Em aberto: <strong className="text-aura-graphite">{moeda(r.kpis.pipelineAberto)}</strong>
                  {r.funil.find((f) => f.tipo === "perda")?.qtd
                    ? ` · ${r.funil.find((f) => f.tipo === "perda")!.qtd} perdido(s)`
                    : ""}
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
                    <Tooltip content={<Dica formato={(v: number) => `${v} atividade(s)`} />} cursor={{ fill: COR.cursor }} />
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
                      <Tooltip content={<Dica formato={(v: number) => `${v} atividade(s)`} />} cursor={{ fill: COR.cursor }} />
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
                  <div key={l.loja} className="rounded-lg border border-aura-mist p-4">
                    <p className="text-sm font-semibold text-aura-graphite">{l.loja}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                      <div><p className="aura-rotulo">Vendido</p><p className="mt-0.5 font-semibold tabular-nums text-aura-graphite">{moedaCurta(l.vendido)}</p></div>
                      <div><p className="aura-rotulo">Vendas</p><p className="mt-0.5 font-semibold tabular-nums text-aura-graphite">{l.vendas}</p></div>
                      <div><p className="aura-rotulo">Atividades</p><p className="mt-0.5 font-semibold tabular-nums text-aura-graphite">{l.atividades}</p></div>
                      <div><p className="aura-rotulo">Pipeline</p><p className="mt-0.5 font-semibold tabular-nums text-aura-graphite">{moedaCurta(l.pipeline)}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </Cartao>
          )}

          {dados?.gestor && r.porVendedor.length > 1 && !vendedor && (
            /* Na tela o gráfico responde "quem vendeu mais" de relance. No
               papel ele vira uma página quase em branco — basta um vendedor
               ter faturado para os outros virarem linhas vazias — e a tabela
               logo abaixo traz os mesmos números com leads, conversão e
               pipeline junto. */
            <Cartao titulo="Vendedores (vendido no período)" className="print:hidden">
              <div style={{ height: Math.max(180, r.porVendedor.length * 38) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={r.porVendedor} layout="vertical" margin={{ top: 0, right: 80, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="nome" width={130} tick={{ fontSize: 12, fill: COR.tinta }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: COR.cursor }}
                      content={({ active, payload }: any) =>
                        active && payload?.length ? (
                          <div className="rounded-lg border border-aura-mist bg-aura-surface px-3 py-2 text-xs shadow-lg">
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
              <div className="overflow-x-auto rounded-lg border border-aura-mist">
                <table className="aura-tabela min-w-[640px] tabular-nums">
                  <thead>
                    <tr>
                      <th>Vendedor</th>
                      <th>Loja</th>
                      <th className="!text-right">Leads</th>
                      <th className="!text-right">Fechou</th>
                      <th className="!text-right">Perdeu</th>
                      <th className="!text-right">Conversão</th>
                      <th className="!text-right">Faturamento</th>
                      <th className="!text-right">Pipeline</th>
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
                        <tr key={v.id}>
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
                conta as etapas que o gestor marcou como “conta no pipeline”.
              </p>
            </Cartao>
          )}

          {/* Top clientes */}
          {r.topClientes.length > 0 && (
            <Cartao titulo="Maiores clientes do período">
              <ol className="space-y-2">
                {r.topClientes.map((c, i) => (
                  <li key={c.cliente} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-aura-sunken text-xs font-semibold tabular-nums text-aura-graphite-soft">{i + 1}</span>
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
