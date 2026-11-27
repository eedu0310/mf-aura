"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  MessageSquare,
  Printer,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
  CalendarRange,
} from "lucide-react";
import type { RelatorioSemanal, VendedorNoRelatorio } from "@/lib/relatorio-semanal/gerar";
import { Alerta, EstadoVazio, classeBotao } from "@/components/ui";
import { IndicadoresDetalhados, LinhaIndicadoresVendedor } from "@/components/aura/indicadores-detalhados";
import type { Indicadores, RelatorioDetalhado } from "@/lib/aura/relatorio-detalhado";

/** Os 10 indicadores da janela do relatório e da janela anterior (rota /api/relatorios/indicadores). */
interface IndicadoresDaJanela {
  atual: RelatorioDetalhado;
  anterior: { geral: Indicadores };
  gestor: boolean;
}

/* Paleta do tema (petrol da marca, verde de acerto, vermelho de alerta), para
   o relatório ficar legível no claro e no escuro. O texto dos eixos herda a
   cor do invólucro (text-aura-graphite-soft) por currentColor. */
const COR = {
  serie: "#138780",
  serie2: "var(--aura-success)",
  alerta: "var(--aura-danger)",
  grade: "var(--aura-mist)",
  texto: "currentColor",
};

interface Periodo {
  periodo_inicio: string;
  periodo_fim: string;
  created_at: string;
}

interface Resposta {
  relatorio: RelatorioSemanal | null;
  textoAntigo: string | null;
  periodos: Periodo[];
  lojas: string[];
  loja: string;
  gestor: boolean;
  podeGerar: boolean;
  erro?: string;
}

const moeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const moedaCurta = (v: number) =>
  v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")} mi`
    : v >= 1000
      ? `R$ ${Math.round(v / 1000)} mil`
      : `R$ ${Math.round(v)}`;
const dataBR = (iso: string) => {
  if (!iso) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};
const primeiroNome = (n: string) => n.trim().split(/\s+/)[0];

function Numero({
  icone,
  label,
  valor,
  sub,
}: {
  icone: React.ReactNode;
  label: string;
  valor: string;
  sub?: string;
}) {
  return (
    <div className="aura-card p-4" data-cartao>
      <div className="flex items-center gap-1.5 text-aura-graphite-soft">
        {icone}
        <span className="aura-rotulo truncate">{label}</span>
      </div>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-aura-graphite">{valor}</p>
      {sub ? <p className="mt-0.5 text-xs text-aura-graphite-soft">{sub}</p> : null}
    </div>
  );
}

function Cartao({
  titulo,
  children,
  className = "",
}: {
  titulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`aura-card p-5 ${className}`} data-cartao>
      <h3 className="mb-3 text-sm font-semibold text-aura-graphite">{titulo}</h3>
      {children}
    </section>
  );
}

/**
 * Barra em CSS, não em Recharts.
 *
 * Dentro do bloco de cada vendedor há de três a quatro listas de barras. Com
 * dez vendedores isso seria quase quarenta gráficos Recharts na mesma tela:
 * lenta para abrir e pior ainda no papel, porque cada um mede o container no
 * instante em que desenha. Barra em CSS imprime igual ao que aparece na tela.
 */
function Barras({
  itens,
  formato = "numero",
}: {
  itens: { rotulo: string; valor: number; nota?: string }[];
  formato?: "numero" | "moeda";
}) {
  const maior = Math.max(1, ...itens.map((i) => i.valor));
  if (!itens.length) {
    return <p className="text-xs text-aura-graphite-soft">Nada registrado no período.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {itens.map((i) => (
        <li key={i.rotulo}>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate text-aura-graphite">{i.rotulo}</span>
            <span className="shrink-0 font-medium text-aura-graphite">
              {formato === "moeda" ? moedaCurta(i.valor) : i.valor}
              {i.nota ? <span className="font-normal text-aura-graphite-soft"> · {i.nota}</span> : null}
            </span>
          </div>
          <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-aura-mist">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(2, (i.valor / maior) * 100)}%`, background: COR.serie }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Barras que abrem (pedido do Elton, 27/11/2026: "o Charles tem 17
 * prospecções, mas não mostra QUAIS são — arquiteto, cliente final, outra
 * coisa; clicar e abrir para baixo"). Cada barra vira um botão; o detalhe
 * abre logo embaixo. Na impressão e no PDF todos os detalhes saem abertos:
 * no papel ninguém clica.
 */
function BarrasQueAbrem({
  itens,
  formato = "numero",
  detalhe,
}: {
  itens: { rotulo: string; valor: number; nota?: string }[];
  formato?: "numero" | "moeda";
  /** O que aparece embaixo da barra aberta (null = a barra não abre). */
  detalhe?: (rotulo: string) => ReactNode | null;
}) {
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const maior = Math.max(1, ...itens.map((i) => i.valor));
  if (!itens.length) {
    return <p className="text-xs text-aura-graphite-soft">Nada registrado no período.</p>;
  }
  const alternar = (r: string) =>
    setAbertas((atual) => {
      const novo = new Set(atual);
      if (novo.has(r)) novo.delete(r);
      else novo.add(r);
      return novo;
    });
  return (
    <ul className="space-y-1.5">
      {itens.map((i) => {
        const conteudo = detalhe ? detalhe(i.rotulo) : null;
        const aberta = abertas.has(i.rotulo);
        const linha = (
          <>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-1 truncate text-aura-graphite">
                {conteudo ? (
                  <span className="text-aura-graphite-soft print:hidden">
                    {aberta ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </span>
                ) : null}
                <span className={conteudo ? "truncate underline decoration-dotted underline-offset-2" : "truncate"}>{i.rotulo}</span>
              </span>
              <span className="shrink-0 font-medium text-aura-graphite">
                {formato === "moeda" ? moedaCurta(i.valor) : i.valor}
                {i.nota ? <span className="font-normal text-aura-graphite-soft"> · {i.nota}</span> : null}
              </span>
            </div>
            <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-aura-mist">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(2, (i.valor / maior) * 100)}%`, background: COR.serie }}
              />
            </div>
          </>
        );
        return (
          <li key={i.rotulo}>
            {conteudo ? (
              <button
                type="button"
                onClick={() => alternar(i.rotulo)}
                aria-expanded={aberta}
                className="block w-full rounded-md text-left transition hover:bg-aura-sunken/60"
                title="Clique para ver um por um"
              >
                {linha}
              </button>
            ) : (
              linha
            )}
            {conteudo ? <div className={`mt-1.5 ${aberta ? "" : "hidden"} print:block`}>{conteudo}</div> : null}
          </li>
        );
      })}
    </ul>
  );
}

/** "Arquiteto: 3 · Cliente Final: 2", para o gestor ver o tipo de cliente de cara. */
function resumoPorTipo(lista: { categoria: string }[]): string {
  const mapa = new Map<string, number>();
  for (const i of lista) mapa.set(i.categoria || "Sem tipo", (mapa.get(i.categoria || "Sem tipo") ?? 0) + 1);
  return [...mapa.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `${c}: ${n}`)
    .join(" · ");
}

function TabelaDeAtividades({ lista }: { lista: NonNullable<VendedorNoRelatorio["crm"]["lista"]> }) {
  if (!lista.length) return <p className="text-[11px] text-aura-graphite-soft">Nenhuma.</p>;
  return (
    <div className="rounded-md border border-aura-mist bg-aura-surface p-2 print:break-inside-avoid">
      <p className="mb-1 text-[11px] font-medium text-aura-graphite-soft">{resumoPorTipo(lista)}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-[11px]">
          <thead>
            <tr className="border-b border-aura-mist text-left text-aura-graphite-soft">
              <th className="py-1 pr-2 font-medium">Dia</th>
              <th className="py-1 pr-2 font-medium">Cliente</th>
              <th className="py-1 pr-2 font-medium">Tipo de cliente</th>
              <th className="py-1 pr-2 font-medium">Como foi</th>
              <th className="py-1 font-medium">Observação</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((a, i) => (
              <tr key={`${a.dia}-${a.cliente}-${i}`} className="border-b border-aura-mist/60 align-top">
                <td className="whitespace-nowrap py-1 pr-2 tabular-nums">{a.dia ? dataBR(a.dia) : "—"}</td>
                <td className="py-1 pr-2 font-medium text-aura-graphite">{a.cliente}</td>
                <td className="py-1 pr-2">{a.categoria}</td>
                <td className="py-1 pr-2">{a.resultado || "—"}</td>
                <td className="py-1 text-aura-graphite-soft">{a.observacao || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabelaDeNegocios({ lista }: { lista: NonNullable<VendedorNoRelatorio["pipeline"]["negocios"]> }) {
  if (!lista.length) return <p className="text-[11px] text-aura-graphite-soft">Nenhum.</p>;
  return (
    <div className="rounded-md border border-aura-mist bg-aura-surface p-2 print:break-inside-avoid">
      <p className="mb-1 text-[11px] font-medium text-aura-graphite-soft">{resumoPorTipo(lista)}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-[11px]">
          <thead>
            <tr className="border-b border-aura-mist text-left text-aura-graphite-soft">
              <th className="py-1 pr-2 font-medium">Cliente</th>
              <th className="py-1 pr-2 font-medium">Tipo de cliente</th>
              <th className="py-1 pr-2 font-medium">Produto</th>
              <th className="py-1 pr-2 text-right font-medium">Valor</th>
              <th className="py-1 text-right font-medium">Parado há</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((n, i) => (
              <tr key={`${n.cliente}-${i}`} className="border-b border-aura-mist/60 align-top">
                <td className="py-1 pr-2 font-medium text-aura-graphite">
                  {n.cliente}
                  {n.origem ? <span className="block text-[10px] font-normal text-aura-graphite-soft">{n.origem}</span> : null}
                </td>
                <td className="py-1 pr-2">{n.categoria}</td>
                <td className="py-1 pr-2">{n.produto || "—"}</td>
                <td className="whitespace-nowrap py-1 pr-2 text-right tabular-nums">{n.valor ? moedaCurta(n.valor) : "—"}</td>
                <td
                  className="whitespace-nowrap py-1 text-right tabular-nums"
                  style={{ color: n.diasParado >= 15 ? COR.alerta : undefined }}
                >
                  {n.diasParado} {n.diasParado === 1 ? "dia" : "dias"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Cliente por cliente (pedido de 27/11/2026: "mostrar onde ele errou em cada
 * cliente e abrir o relatório da própria conversa"). Quem tem muito lead de
 * campanha recebe só as conversas que mais importam — mais avançadas no
 * funil, com valor ou com alerta. Cada uma abre com o resumo da AURA, onde
 * errou, como melhorar e a próxima ação, e leva ao laudo completo da conversa.
 */
function ConversasDoVendedor({ v, comLaudo }: { v: VendedorNoRelatorio; comLaudo: boolean }) {
  const conversas = v.atendimento.conversas;
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  if (!conversas) return null; // relatório guardado antes desta lista existir
  if (!conversas.length) {
    return <p className="text-xs text-aura-graphite-soft">Nenhuma conversa comercial analisada no período.</p>;
  }
  const fora = v.atendimento.conversasForaDaLista ?? 0;
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-aura-graphite-soft">
        {fora > 0
          ? `As ${conversas.length} conversas que mais importam (mais avançadas no funil, com valor ou com alerta) — ${fora} outras ficaram de fora.`
          : `${conversas.length} ${conversas.length === 1 ? "conversa" : "conversas"} no período.`}{" "}
        Clique no cliente para ver onde errou.
      </p>
      <ul className="divide-y divide-aura-mist rounded-md border border-aura-mist bg-aura-surface">
        {conversas.map((c) => {
          const aberta = abertas.has(c.id);
          return (
            <li key={c.id} className="print:break-inside-avoid">
              <button
                type="button"
                onClick={() =>
                  setAbertas((atual) => {
                    const novo = new Set(atual);
                    if (novo.has(c.id)) novo.delete(c.id);
                    else novo.add(c.id);
                    return novo;
                  })
                }
                aria-expanded={aberta}
                className="flex w-full items-start gap-2 px-2.5 py-2 text-left text-xs transition hover:bg-aura-sunken/60"
              >
                <span className="mt-0.5 text-aura-graphite-soft print:hidden">
                  {aberta ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-aura-graphite">{c.cliente}</span>
                  {c.etapa ? <span className="text-aura-graphite-soft"> · {c.etapa}</span> : null}
                  {c.valor ? <span className="text-aura-graphite-soft"> · {moedaCurta(c.valor)}</span> : null}
                  {c.interesse ? <span className="block truncate text-[11px] text-aura-graphite-soft">{c.interesse}</span> : null}
                </span>
                {c.alertas.length ? (
                  <span className="shrink-0 text-[11px] font-medium" style={{ color: COR.alerta }}>
                    {c.alertas.length} {c.alertas.length === 1 ? "erro" : "erros"}
                  </span>
                ) : (
                  <span className="shrink-0 text-[11px] text-aura-success">sem alerta</span>
                )}
              </button>
              <div className={`space-y-1.5 px-7 pb-2.5 text-[11px] ${aberta ? "" : "hidden"} print:block`}>
                {c.resumo ? <p className="text-aura-graphite">{c.resumo}</p> : null}
                {c.alertas.length ? (
                  <div>
                    <p className="font-medium" style={{ color: COR.alerta }}>Onde errou</p>
                    <ul className="list-disc pl-4 text-aura-graphite">
                      {c.alertas.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {c.dicas.length ? (
                  <div>
                    <p className="font-medium text-aura-graphite">Como melhorar</p>
                    <ul className="list-disc pl-4 text-aura-graphite-soft">
                      {c.dicas.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {c.proximaAcao ? (
                  <p>
                    <span className="font-medium text-aura-graphite">Próxima ação: </span>
                    <span className="text-aura-graphite-soft">{c.proximaAcao}</span>
                  </p>
                ) : null}
                {/* O laudo fica no Painel do Gestor: o vendedor não abre. */}
                {comLaudo ? (
                  <a
                    href={`/gestor?aba=equipe&conversa=${encodeURIComponent(c.id)}`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1 font-medium text-aura-petrol-600 hover:underline print:hidden"
                  >
                    <ExternalLink className="h-3 w-3" /> Abrir o laudo completo da conversa
                  </a>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Dica({ active, payload, label, formato }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-aura-mist bg-aura-surface px-2.5 py-1.5 text-xs shadow-lg">
      <p className="font-medium text-aura-graphite">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-aura-graphite-soft">
          {p.name}: {formato === "moeda" ? moeda(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

function CabecalhoImpressao({ r }: { r: RelatorioSemanal }) {
  return (
    <header className="hidden print:block" data-cabecalho-impressao>
      <div className="flex items-end justify-between border-b-2 border-aura-navy-950 pb-2">
        <div>
          {/*
            O título diz o que o relatório É. Um relatório de um dia chamado
            "semanal" faria o gestor comparar números de 1 dia com a meta de
            uma semana sem perceber.
          */}
          <p className="font-display text-xl font-semibold text-aura-graphite">
            {r.periodoInicio === r.periodoFim
              ? "Relatório do dia"
              : diasEntre(r.periodoInicio, r.periodoFim) >= 6
                ? "Relatório semanal"
                : "Relatório do período"}
          </p>
          <p className="text-[11px] text-aura-graphite-soft">AURA · Grupo MF</p>
        </div>
        <div className="text-right text-[11px] text-aura-graphite-soft">
          <p>
            <strong className="text-aura-graphite">Loja:</strong> {r.empresa}
          </p>
          <p>
            <strong className="text-aura-graphite">Período:</strong>{" "}
            {r.periodoInicio === r.periodoFim
              ? dataBR(r.periodoInicio)
              : `${dataBR(r.periodoInicio)} a ${dataBR(r.periodoFim)}`}
          </p>
          <p>
            Gerado em{" "}
            {new Date(r.geradoEm).toLocaleString("pt-BR", {
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

/** A avaliação que a AURA fez do atendimento da semana. */
function Avaliacao({ v }: { v: VendedorNoRelatorio }) {
  const a = v.avaliacao;

  if (a.semDados) {
    return (
      <div className="rounded-lg border border-aura-mist bg-aura-sunken px-3 py-2 text-xs text-aura-graphite-soft">
        {a.resumo}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {a.resumo ? <p className="text-xs leading-relaxed text-aura-graphite">{a.resumo}</p> : null}

      {a.acertos.length ? (
        <div>
          <p className="aura-rotulo mb-1 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" style={{ color: COR.serie2 }} />
            Fez certo
          </p>
          <ul className="space-y-1">
            {a.acertos.map((t, i) => (
              <li key={i} className="flex gap-1.5 text-xs text-aura-graphite">
                <span className="mt-[0.3rem] h-1 w-1 shrink-0 rounded-full" style={{ background: COR.serie2 }} />
                {t}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {a.erros.length ? (
        <div>
          <p className="aura-rotulo mb-1 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" style={{ color: COR.alerta }} />
            Onde errou
          </p>
          <ul className="space-y-2">
            {a.erros.map((e, i) => (
              <li key={i} className="border-l-2 pl-2.5 text-xs" style={{ borderColor: COR.alerta }}>
                <p className="font-medium text-aura-graphite">{e.ponto}</p>
                {e.porque ? <p className="text-aura-graphite-soft">{e.porque}</p> : null}
                {e.exemplo ? (
                  <p className="mt-0.5 text-[11px] text-aura-graphite-soft">
                    <span className="font-medium">Exemplo:</span> {e.exemplo}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {a.comoMelhorar.length ? (
        <div>
          <p className="aura-rotulo mb-1">
            Para a semana que vem
          </p>
          <ol className="space-y-1">
            {a.comoMelhorar.map((t, i) => (
              <li key={i} className="flex gap-2 text-xs text-aura-graphite">
                <span className="shrink-0 font-semibold text-aura-graphite-soft">{i + 1}.</span>
                {t}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {a.semManual ? (
        <p className="text-[11px] text-aura-graphite-soft">
          Esta loja está sem manual carregado, então os apontamentos acima não têm o manual como
          âncora.
        </p>
      ) : null}
    </div>
  );
}

function MetasDoVendedor({ v }: { v: VendedorNoRelatorio }) {
  if (!v.metas) {
    return (
      <p className="text-xs text-aura-graphite-soft">
        Sem meta do mês aprovada. Sem ela não dá para dizer se o ritmo está dentro do combinado.
      </p>
    );
  }
  const arq = v.prospeccao.porCategoria.find((c) => c.categoria === "Arquiteto");
  const con = v.prospeccao.porCategoria.find((c) => c.categoria === "Construtora");
  const obr = v.prospeccao.porCategoria.find((c) => c.categoria === "Obra");

  /* A meta é do MÊS e a semana é um quarto dele: o alvo da semana é a
     referência honesta, senão tudo pareceria sempre atrasado. */
  const linhas = [
    { o: "Faturamento", feito: v.vendas.valor, metaMes: v.metas.faturamento, moeda: true },
    { o: "Clientes novos", feito: v.prospeccao.clientesNovos, metaMes: v.metas.clientesNovos },
    { o: "Arquitetos", feito: arq?.atividades ?? 0, metaMes: v.metas.arquitetos },
    { o: "Construtoras", feito: con?.atividades ?? 0, metaMes: v.metas.construtoras },
    { o: "Obras", feito: obr?.atividades ?? 0, metaMes: v.metas.obras },
    { o: "Visitas", feito: v.crm.visitas, metaMes: v.metas.visitas },
    { o: "Ligações", feito: v.crm.ligacoes, metaMes: v.metas.ligacoes },
  ].filter((l) => l.metaMes > 0);

  if (!linhas.length) {
    return <p className="text-xs text-aura-graphite-soft">A meta aprovada está toda em zero.</p>;
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="aura-rotulo text-left">
          <th className="pb-1 font-medium">Item</th>
          <th className="pb-1 text-right font-medium">Semana</th>
          <th className="pb-1 text-right font-medium">Alvo/sem.</th>
          <th className="pb-1 text-right font-medium">Meta mês</th>
        </tr>
      </thead>
      <tbody>
        {linhas.map((l) => {
          const alvo = l.metaMes / 4;
          const ok = l.feito >= alvo;
          return (
            <tr key={l.o} className="border-t border-aura-mist">
              <td className="py-1 text-aura-graphite">{l.o}</td>
              <td
                className="py-1 text-right font-medium"
                style={{ color: ok ? COR.serie2 : COR.alerta }}
              >
                {l.moeda ? moedaCurta(l.feito) : l.feito}
              </td>
              <td className="py-1 text-right text-aura-graphite-soft">
                {l.moeda ? moedaCurta(alvo) : Math.round(alvo * 10) / 10}
              </td>
              <td className="py-1 text-right text-aura-graphite-soft">
                {l.moeda ? moedaCurta(l.metaMes) : l.metaMes}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * Onde o vendedor está na meta do MÊS, não na semana.
 *
 * A tabela acima compara a semana com um quarto da meta, que serve de ritmo.
 * Esta aqui responde a outra pergunta, a que o gestor faz na reunião: quanto
 * falta e quanto por dia para fechar. Relatório antigo (versão 2) não tem este
 * campo, então simplesmente não aparece.
 */
function ProgressoNoMes({ v }: { v: VendedorNoRelatorio }) {
  const p = v.progresso;
  if (!p || p.itens.length === 0) return null;
  const valor = (n: number, emReais: boolean) =>
    emReais ? moedaCurta(n) : String(Math.round(n * 100) / 100);

  return (
    <div className="mt-4 rounded-lg border border-aura-mist bg-aura-sunken/60 p-3">
      <p className="aura-rotulo mb-2">
        Acumulado do mês até {p.apuradoAte.split("-").reverse().join("/")} —{" "}
        {p.diasUteisRestantes} {p.diasUteisRestantes === 1 ? "dia útil restante" : "dias úteis restantes"}
      </p>
      <div className="space-y-2">
        {p.itens.map((i) => {
          const largura = Math.min(100, Math.max(0, i.percentual));
          const bateu = i.falta === 0;
          return (
            <div key={i.rotulo}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-aura-graphite">{i.rotulo}</span>
                <span className="font-medium text-aura-graphite">
                  {valor(i.atingido, i.emReais)} / {valor(i.meta, i.emReais)}{" "}
                  <span style={{ color: bateu ? COR.serie2 : COR.alerta }}>({i.percentual}%)</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-aura-mist">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${largura}%`, backgroundColor: bateu ? COR.serie2 : COR.alerta }}
                />
              </div>
              <p className="mt-0.5 text-[11px] text-aura-graphite-soft">
                {bateu
                  ? "Meta batida."
                  : `Faltam ${valor(i.falta, i.emReais)} — ` +
                    (p.diasUteisRestantes > 0
                      ? `${valor(i.porDiaUtil, i.emReais)} por dia útil.`
                      : "o mês acabou.")}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Agenda: marcado, cumprido e furado.
 *
 * Separar "marcou" de "cumpriu" é o ponto. Um número só deixaria igual quem
 * marcou dez visitas e fez dez e quem marcou dez e fez duas — que é
 * exatamente a conversa que o gestor precisa ter.
 */
/**
 * Quem o vendedor prospectou, um por um. O total por tipo de cliente dizia
 * QUANTO; o gestor precisava ver QUEM, para cobrar o retorno de cada um.
 */
function ProspeccoesDoVendedor({ v }: { v: VendedorNoRelatorio }) {
  const lista = v.prospeccao.lista;
  if (!lista) return null; // relatório guardado antes desta lista existir
  const corDoResultado = (r: string) => {
    const t = r.toLowerCase();
    if (t.startsWith("boa") || t.startsWith("ótima") || t.startsWith("otima")) return "text-aura-success";
    if (t.startsWith("sem")) return "text-aura-danger";
    return "text-aura-graphite";
  };
  return (
    <div className="rounded-lg border border-aura-mist p-3 print:break-inside-avoid">
      <p className="aura-rotulo mb-1">
        Quem ele prospectou ({lista.length})
      </p>
      {lista.length === 0 ? (
        <p className="text-xs text-aura-graphite-soft">Nenhuma prospecção lançada no período.</p>
      ) : (
        <>
          {v.prospeccao.porResultado?.length ? (
            <p className="mb-2 text-[11px] text-aura-graphite-soft">
              {v.prospeccao.porResultado.map((r) => `${r.resultado}: ${r.n}`).join(" · ")}
            </p>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs">
              <thead>
                <tr className="border-b border-aura-mist text-left text-aura-graphite-soft">
                  <th className="py-1.5 pr-3 font-medium">Dia</th>
                  <th className="py-1.5 pr-3 font-medium">Cliente</th>
                  <th className="py-1.5 pr-3 font-medium">Tipo</th>
                  <th className="py-1.5 pr-3 font-medium">Cidade</th>
                  <th className="py-1.5 pr-3 font-medium">Como foi</th>
                  <th className="py-1.5 font-medium">Observação</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p, i) => (
                  <tr key={`${p.dia}-${p.cliente}-${i}`} className="border-b border-aura-mist/60 align-top">
                    <td className="whitespace-nowrap py-1.5 pr-3 tabular-nums">{p.dia ? dataBR(p.dia) : "—"}</td>
                    <td className="py-1.5 pr-3 font-medium text-aura-graphite">{p.cliente}</td>
                    <td className="py-1.5 pr-3">{p.categoria}</td>
                    <td className="py-1.5 pr-3">{p.cidade || "—"}</td>
                    <td className={`whitespace-nowrap py-1.5 pr-3 font-medium ${corDoResultado(p.resultado)}`}>
                      {p.resultado || "—"}
                    </td>
                    <td className="py-1.5 text-aura-graphite-soft">{p.observacao || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function AgendaDoVendedor({ v }: { v: VendedorNoRelatorio }) {
  const a = v.agenda;
  if (!a) return null;
  if (a.paraASemana === 0 && a.marcados === 0) {
    return (
      <p className="text-xs text-aura-graphite-soft">
        Nenhum compromisso na agenda esta semana.
      </p>
    );
  }
  const taxa = a.paraASemana > 0 ? Math.round((a.realizados / a.paraASemana) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          ["Marcados p/ a semana", a.paraASemana, undefined],
          ["Realizados", a.realizados, COR.serie2],
          ["Não cumpridos", a.naoCumpridos, a.naoCumpridos ? COR.alerta : undefined],
        ].map(([rotulo, n, cor]) => (
          <div key={String(rotulo)} className="rounded-lg border border-aura-mist bg-aura-sunken/60 p-2">
            <p className="font-data text-lg font-semibold text-aura-graphite" style={cor ? { color: String(cor) } : undefined}>
              {String(n)}
            </p>
            <p className="text-[10px] leading-tight text-aura-graphite-soft">{String(rotulo)}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-aura-graphite-soft">
        {a.paraASemana > 0 && <>Cumpriu {taxa}% do que estava marcado. </>}
        Marcou {a.marcados} nesta semana
        {a.porTipo.length > 0 && <> · {a.porTipo.map((t) => `${t.n} ${t.tipo}`).join(", ")}</>}
      </p>
    </div>
  );
}

/**
 * Os números da semana em palavras, na ordem em que o gestor cobra.
 *
 * Zero é omitido de propósito: uma linha com "0 ligações · 0 orçamentos · 0
 * agendamentos" rouba a atenção do que a pessoa de fato fez. O que não
 * aconteceu aparece no detalhe, dentro do bloco.
 */
function diasEntre(a: string, b: string): number {
  return Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000);
}

function placarDaSemana(v: VendedorNoRelatorio): string[] {
  const partes: string[] = [];
  const por = (n: number, um: string, varios: string) => {
    if (n > 0) partes.push(`${n} ${n === 1 ? um : varios}`);
  };
  por(v.prospeccao.clientesNovos, "cliente cadastrado", "clientes cadastrados");
  por(v.crm.visitas, "visita", "visitas");
  por(v.crm.ligacoes, "ligação", "ligações");
  por(v.agenda?.paraASemana ?? 0, "agendamento", "agendamentos");
  por(v.crm.orcamentos, "orçamento", "orçamentos");
  por(v.crm.followUps, "follow-up", "follow-ups");
  por(v.atendimento.conversasAtivas, "conversa", "conversas");
  por(v.pipeline.criados, "negócio criado", "negócios criados");
  por(v.vendas.quantidade, "venda", "vendas");
  return partes;
}

function BlocoDoVendedor({
  v,
  abertoInicial,
  indicadores,
  mes,
  comLaudo,
}: {
  v: VendedorNoRelatorio;
  abertoInicial: boolean;
  /** Gestor: mostra o link para o laudo completo de cada conversa. */
  comLaudo: boolean;
  /** Os 10 indicadores dele na semana (receita, conversão, margem, ciclo...). */
  indicadores?: Indicadores;
  mes?: string;
}) {
  const [aberto, setAberto] = useState(abertoInicial);

  return (
    <section className="aura-card" data-cartao>
      <button
        type="button"
        onClick={() => setAberto((x) => !x)}
        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition hover:bg-aura-sunken/60 print:cursor-auto"
        aria-expanded={aberto}
      >
        <span className="text-aura-graphite-soft print:hidden">
          {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-aura-graphite">
            {v.nome}
          </span>
          <span className="block text-[11px] text-aura-graphite-soft">{v.cargo}</span>
          {/*
            O placar da reunião.
            Antes o cabeçalho dizia "CRM: 12", que não conta o que a pessoa
            fez — o gestor abria cada bloco para descobrir. Aqui estão, em uma
            linha lida em voz alta, os números que ele cobra: cadastrou,
            visitou, ligou, agendou, orçou, conversou. Só aparece o que
            aconteceu, para a linha não virar uma fileira de zeros.
          */}
          <span className="mt-1 block text-xs text-aura-graphite">
            {placarDaSemana(v).join(" · ") || "sem atividade registrada na semana"}
          </span>
        </span>
        <span className="hidden shrink-0 gap-4 text-right sm:flex print:flex">
          <span>
            <span className="aura-rotulo block text-[10px]">
              Vendido
            </span>
            <span className="block text-sm font-semibold tabular-nums text-aura-graphite">
              {moedaCurta(v.vendas.valor)}
            </span>
          </span>
          <span>
            <span className="aura-rotulo block text-[10px]">
              CRM
            </span>
            <span className="block text-sm font-semibold tabular-nums text-aura-graphite">{v.crm.atividades}</span>
          </span>
          <span>
            <span className="aura-rotulo block text-[10px]">
              Conversas
            </span>
            <span className="block text-sm font-semibold tabular-nums text-aura-graphite">
              {v.atendimento.conversasAtivas}
            </span>
          </span>
          <span>
            <span className="aura-rotulo block text-[10px]">
              Alertas
            </span>
            <span
              className="block text-sm font-semibold"
              style={{ color: v.atendimento.conversasComAlerta ? COR.alerta : undefined }}
            >
              {v.atendimento.conversasComAlerta}
            </span>
          </span>
        </span>
      </button>

      {/*
        O conteúdo é SEMPRE renderizado e apenas escondido por CSS quando o
        bloco está fechado. Com renderização condicional, o vendedor de bloco
        fechado simplesmente não saía no PDF — e o relatório impresso é
        justamente onde ninguém está ali para clicar e abrir.
      */}
      <div
        className={`space-y-4 border-t border-aura-mist px-4 py-4 print:block ${
          aberto ? "" : "hidden"
        }`}
      >
          {indicadores && mes && <LinhaIndicadoresVendedor v={indicadores} mes={mes} />}
          <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
            <div>
              <p className="aura-rotulo mb-2">
                O que ele fez no CRM
              </p>
              <BarrasQueAbrem
                itens={v.crm.porTipo.map((t) => ({ rotulo: t.tipo, valor: t.n }))}
                detalhe={
                  v.crm.lista
                    ? (tipo) => <TabelaDeAtividades lista={v.crm.lista!.filter((a) => a.tipo === tipo)} />
                    : undefined
                }
              />
              <p className="mt-2 text-[11px] text-aura-graphite-soft">
                {v.crm.visitas} visitas · {v.crm.ligacoes} ligações · {v.crm.orcamentos} orçamentos ·{" "}
                {v.crm.followUps} follow-ups
              </p>
            </div>

            <div>
              {/* Conta TODA atividade com o cliente (WhatsApp, visita, venda…),
                  não só as de prospecção: o título antigo prometia outra coisa
                  e não batia com "Quem ele prospectou" (27/11/2026). */}
              <p className="aura-rotulo mb-2">
                Atividades por tipo de cliente
              </p>
              <BarrasQueAbrem
                itens={v.prospeccao.porCategoria.map((c) => ({
                  rotulo: c.categoria,
                  valor: c.atividades,
                  nota: c.clientesNovos ? `${c.clientesNovos} novo(s)` : undefined,
                }))}
                detalhe={
                  v.crm.lista
                    ? (categoria) => <TabelaDeAtividades lista={v.crm.lista!.filter((a) => a.categoria === categoria)} />
                    : undefined
                }
              />
              <p className="mt-2 text-[11px] text-aura-graphite-soft">
                {v.prospeccao.clientesNovos} cliente(s) cadastrado(s) na semana
              </p>
            </div>

            <div>
              <p className="aura-rotulo mb-2">
                Pipeline dele
              </p>
              <BarrasQueAbrem
                itens={v.pipeline.porEtapa.map((e) => ({
                  rotulo: e.etapa,
                  valor: e.negocios,
                  nota: moedaCurta(e.valor),
                }))}
                detalhe={
                  v.pipeline.negocios
                    ? (etapa) => <TabelaDeNegocios lista={v.pipeline.negocios!.filter((n) => n.etapa === etapa)} />
                    : undefined
                }
              />
              <p className="mt-2 text-[11px] text-aura-graphite-soft">
                {v.pipeline.criados} criados · {v.pipeline.ganhos} ganhos · {v.pipeline.perdidos}{" "}
                perdidos · {moedaCurta(v.pipeline.valorEmAberto)} em aberto
              </p>
              {v.pipeline.motivosDePerda.length ? (
                <p className="mt-1 text-[11px] text-aura-graphite-soft">
                  Perdeu por: {v.pipeline.motivosDePerda.map((m) => `${m.motivo} (${m.n})`).join(", ")}
                </p>
              ) : null}
            </div>

            <div>
              <p className="aura-rotulo mb-2">
                Agenda da semana
              </p>
              <AgendaDoVendedor v={v} />
            </div>

            <div>
              <p className="aura-rotulo mb-2">
                Meta do mês contra a semana
              </p>
              <MetasDoVendedor v={v} />
              <ProgressoNoMes v={v} />
            </div>
          </div>

          <ProspeccoesDoVendedor v={v} />

          <div className="rounded-lg border border-aura-mist bg-aura-sunken/60 p-3">
            <p className="aura-rotulo mb-2 flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Atendimento no WhatsApp
            </p>
            <p className="mb-3 text-xs text-aura-graphite">
              {v.atendimento.conversasAtivas} conversas ativas ({v.atendimento.conversasNovas} novas)
              · {v.atendimento.conversasComAlerta} com alerta ·{" "}
              {v.atendimento.conversasSemProximaAcao} sem próxima ação definida
              {v.atendimento.conversasIgnoradas
                ? ` · ${v.atendimento.conversasIgnoradas} marcadas como não comerciais`
                : ""}
            </p>

            {/*
              Lista, não gráfico de frequência. A AURA escreve um alerta sob
              medida para cada conversa, então na prática nenhum texto se
              repete: um gráfico de barras aqui mostraria uma fileira de
              barras todas iguais a 1, fingindo que mediu recorrência.
              Quem enxerga o PADRÃO é a síntese logo abaixo, que lê todos os
              alertas da semana e nomeia o tema. Aqui ficam os casos crus,
              para o gestor conferir a avaliação contra a evidência.
            */}
            {v.atendimento.alertas.length ? (
              <div className="mb-3">
                <p className="mb-1 text-[11px] font-medium text-aura-graphite-soft">
                  Alertas da semana, conversa por conversa
                  {v.atendimento.alertas.length > 6
                    ? ` (6 de ${v.atendimento.alertas.length})`
                    : ""}
                </p>
                <ul className="space-y-1">
                  {v.atendimento.alertas.slice(0, 6).map((a, i) => (
                    <li key={i} className="flex gap-1.5 text-[11px] text-aura-graphite">
                      <span
                        className="mt-[0.35rem] h-1 w-1 shrink-0 rounded-full"
                        style={{ background: COR.alerta }}
                      />
                      <span>
                        {a.texto}
                        {a.conversas > 1 ? (
                          <span className="text-aura-graphite-soft"> ({a.conversas} conversas)</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {v.atendimento.conversas ? (
              <div className="mb-3">
                <p className="mb-1 text-[11px] font-medium text-aura-graphite-soft">Cliente por cliente</p>
                <ConversasDoVendedor v={v} comLaudo={comLaudo} />
              </div>
            ) : null}

            <Avaliacao v={v} />
          </div>
      </div>
    </section>
  );
}

export function RelatorioSemanalView() {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [loja, setLoja] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<string | null>(null);
  const [menuGerar, setMenuGerar] = useState(false);
  const [preparandoImpressao, setPreparandoImpressao] = useState(false);

  const buscar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const q = new URLSearchParams();
      if (loja) q.set("loja", loja);
      if (periodo) q.set("periodo", periodo);
      const resp = await fetch(`/api/relatorios/semanal?${q}`, { cache: "no-store" });
      const j = (await resp.json()) as Resposta;
      if (!resp.ok) {
        setErro(j.erro ?? "Não consegui carregar o relatório.");
        setDados(null);
      } else {
        setDados(j);
      }
    } catch {
      setErro("Não consegui falar com o servidor.");
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }, [loja, periodo]);

  useEffect(() => {
    void buscar();
  }, [buscar]);

  // Os 10 indicadores da mesma janela do relatório, e da anterior para
  // comparar. Vêm à parte: o relatório gravado no sábado não tinha esses
  // números, e assim eles valem também para os relatórios já gerados.
  const [ind, setInd] = useState<IndicadoresDaJanela | null>(null);
  const janela = dados?.relatorio ? `${dados.relatorio.empresa}|${dados.relatorio.periodoInicio}|${dados.relatorio.periodoFim}` : null;
  useEffect(() => {
    if (!janela) {
      setInd(null);
      return;
    }
    const [empresa, inicio, fim] = janela.split("|");
    let vivo = true;
    fetch(`/api/relatorios/indicadores?${new URLSearchParams({ loja: empresa, inicio, fim })}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (vivo) setInd(j as IndicadoresDaJanela | null);
      })
      .catch(() => {
        if (vivo) setInd(null);
      });
    return () => {
      vivo = false;
    };
  }, [janela]);

  /**
   * Gera um relatório de qualquer janela.
   *
   * O de sábado continua automático. Este botão existe porque o gestor
   * passava a semana sem saber o que a equipe estava fazendo — "às cegas",
   * nas palavras dele — e só descobria no sábado. "Hoje" e "Ontem" respondem
   * isso; "Últimos 7 dias" é a semana corrida, sem esperar a segunda-feira.
   */
  async function gerarJanela(janela: "hoje" | "ontem" | "7dias" | "semana") {
    setGerando(true);
    setErro(null);
    setMenuGerar(false);
    const hojeBR = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const dias = (n: number) => {
      const d = new Date(`${hojeBR}T12:00:00-03:00`);
      d.setUTCDate(d.getUTCDate() + n);
      return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    };
    const corpo: Record<string, string | undefined> = { loja: loja ?? dados?.loja };
    if (janela === "hoje") Object.assign(corpo, { inicio: hojeBR, fim: hojeBR });
    else if (janela === "ontem") Object.assign(corpo, { inicio: dias(-1), fim: dias(-1) });
    else if (janela === "7dias") Object.assign(corpo, { inicio: dias(-6), fim: hojeBR });
    // "semana": sem inicio/fim, a rota usa a segunda-feira como sempre.

    try {
      const resp = await fetch("/api/relatorios/semanal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const j = await resp.json();
      if (!resp.ok) setErro(j.erro ?? "Não consegui gerar o relatório.");
      else {
        // Abre direto no período que acabou de ser gerado.
        if (j.relatorio?.periodoInicio) setPeriodo(`${j.relatorio.periodoInicio}|${j.relatorio.periodoFim}`);
        await buscar();
      }
    } catch {
      setErro("Não consegui falar com o servidor.");
    } finally {
      setGerando(false);
    }
  }

  /* Mesma espera do Relatório do Período: a área encolhe para a largura da
     folha, o Recharts remede e redesenha, e só então a janela de impressão
     abre. Sem a espera, o papel sai com o desenho da tela larga, cortado. */
  async function imprimir() {
    setPreparandoImpressao(true);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
    await new Promise((r) => setTimeout(r, 400));
    try {
      window.print();
    } finally {
      setPreparandoImpressao(false);
    }
  }

  const r = dados?.relatorio ?? null;

  const porVendedor = useMemo(
    () =>
      (r?.vendedores ?? []).map((v) => ({
        nome: primeiroNome(v.nome),
        vendido: v.vendas.valor,
        atividades: v.crm.atividades,
        conversas: v.atendimento.conversasAtivas,
        alertas: v.atendimento.conversasComAlerta,
      })),
    [r],
  );

  /* A prospecção da loja inteira por tipo de cliente: é o corte que o gestor
     pediu nominalmente (arquiteto, cliente final, obra, designer). */
  const prospeccaoDaLoja = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const v of r?.vendedores ?? []) {
      for (const c of v.prospeccao.porCategoria) {
        mapa.set(c.categoria, (mapa.get(c.categoria) ?? 0) + c.atividades);
      }
    }
    return [...mapa.entries()]
      .map(([categoria, atividades]) => ({ categoria, atividades }))
      .sort((a, b) => b.atividades - a.atividades);
  }, [r]);

  if (carregando && !dados) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-aura-graphite-soft">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando o relatório da semana...
      </div>
    );
  }

  return (
    <div className={`space-y-5 ${preparandoImpressao ? "modo-impressao" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {dados && dados.lojas.length > 1 ? (
          <select
            value={loja ?? dados.loja}
            onChange={(e) => {
              setLoja(e.target.value);
              setPeriodo(null);
            }}
            className="aura-input w-auto"
            aria-label="Loja"
          >
            {dados.lojas.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        ) : null}

        {dados?.periodos.length ? (
          <select
            value={periodo ?? `${dados.periodos[0].periodo_inicio}|${dados.periodos[0].periodo_fim}`}
            onChange={(e) => setPeriodo(e.target.value)}
            className="aura-input w-auto"
            aria-label="Período"
          >
            {dados.periodos.map((p) => (
              <option key={`${p.periodo_inicio}|${p.periodo_fim}`} value={`${p.periodo_inicio}|${p.periodo_fim}`}>
                {p.periodo_inicio === p.periodo_fim
                  ? `Dia ${dataBR(p.periodo_inicio)}`
                  : `${dataBR(p.periodo_inicio)} a ${dataBR(p.periodo_fim)}`}
              </option>
            ))}
          </select>
        ) : null}

        {dados?.podeGerar ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuGerar((v) => !v)}
              disabled={gerando}
              className={classeBotao("secundario")}
            >
              {gerando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {gerando ? "Gerando..." : "Gerar relatório"}
            </button>
            {menuGerar && !gerando && (
              <div className="absolute left-0 top-11 z-30 w-52 aura-card rounded-xl py-1 shadow-xl">
                {(
                  [
                    ["hoje", "Hoje"],
                    ["ontem", "Ontem"],
                    ["7dias", "Últimos 7 dias"],
                    ["semana", "Esta semana (seg → hoje)"],
                  ] as const
                ).map(([chave, rotulo]) => (
                  <button
                    key={chave}
                    type="button"
                    onClick={() => void gerarJanela(chave)}
                    className="block w-full px-3 py-2 text-left text-sm text-aura-graphite hover:bg-aura-sunken"
                  >
                    {rotulo}
                  </button>
                ))}
                <p className="border-t border-aura-mist px-3 py-2 text-[11px] text-aura-graphite-soft">
                  Cada geração avalia cada vendedor com a IA. Leva alguns segundos.
                </p>
              </div>
            )}
          </div>
        ) : null}

        {r ? (
          <button
            type="button"
            onClick={imprimir}
            className={classeBotao("primario")}
          >
            <Printer className="h-4 w-4" />
            Imprimir / PDF
          </button>
        ) : null}
      </div>

      {erro ? <Alerta tom="perigo" titulo={erro} /> : null}

      {dados?.textoAntigo ? (
        <Cartao titulo="Relatório desta semana (formato antigo)">
          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-aura-graphite">
            {dados.textoAntigo}
          </pre>
        </Cartao>
      ) : null}

      {!r && !dados?.textoAntigo && !erro ? (
        <EstadoVazio
          icone={CalendarRange}
          titulo="Nenhum relatório semanal gerado ainda."
          descricao={
            <>
              O relatório é gerado automaticamente todo sábado às 16h.
              {dados?.podeGerar ? " Você também pode gerar o desta semana agora, pelo botão acima." : ""}
            </>
          }
        />
      ) : null}

      {r ? (
        <>
          <CabecalhoImpressao r={r} />

          <div className="print:hidden">
            <h2 className="font-display text-lg font-semibold text-aura-graphite">
              {r.empresa}
            </h2>
            <p className="text-xs text-aura-graphite-soft">
              Semana de {dataBR(r.periodoInicio)} a {dataBR(r.periodoFim)} · gerado em{" "}
              {new Date(r.geradoEm).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 print:grid-cols-4 print:gap-2">
            <Numero
              icone={<TrendingUp className="h-3.5 w-3.5" />}
              label="Vendido"
              valor={moedaCurta(r.totais.valorVendido)}
              sub={`${r.totais.negociosGanhos} ganho(s), ${r.totais.negociosPerdidos} perdido(s)`}
            />
            <Numero
              icone={<Users className="h-3.5 w-3.5" />}
              label="Equipe"
              valor={String(r.totais.vendedores)}
              sub={`${r.totais.clientesNovos} cliente(s) novo(s)`}
            />
            <Numero
              icone={<Target className="h-3.5 w-3.5" />}
              label="CRM"
              valor={String(r.totais.atividades)}
              sub={`${r.totais.visitas} visita(s), ${r.totais.negociosCriados} negócio(s) criado(s)`}
            />
            <Numero
              icone={<MessageSquare className="h-3.5 w-3.5" />}
              label="Conversas"
              valor={String(r.totais.conversasAtivas)}
              sub={`${r.totais.conversasComAlerta} com alerta da AURA`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
            <Cartao titulo="Vendido por vendedor na semana">
              <div className="h-56 text-aura-graphite-soft">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porVendedor} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={COR.grade} vertical={false} />
                    <XAxis dataKey="nome" tick={{ fontSize: 11, fill: COR.texto }} interval={0} />
                    <YAxis tickFormatter={(v) => moedaCurta(Number(v))} tick={{ fontSize: 11, fill: COR.texto }} />
                    <Tooltip content={<Dica formato="moeda" />} />
                    <Bar dataKey="vendido" name="Vendido" fill={COR.serie} radius={[4, 4, 0, 0]}>
                      <LabelList
                        dataKey="vendido"
                        position="top"
                        formatter={(v: unknown) => (Number(v) ? moedaCurta(Number(v)) : "")}
                        style={{ fontSize: 10, fill: COR.texto }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Cartao>

            <Cartao titulo="Prospecção da loja por tipo de cliente">
              <div className="h-56 text-aura-graphite-soft">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={prospeccaoDaLoja}
                    layout="vertical"
                    margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid stroke={COR.grade} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: COR.texto }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="categoria"
                      width={110}
                      tick={{ fontSize: 11, fill: COR.texto }}
                    />
                    <Tooltip content={<Dica />} />
                    <Bar dataKey="atividades" name="Atividades" fill={COR.serie2} radius={[0, 4, 4, 0]}>
                      <LabelList
                        dataKey="atividades"
                        position="right"
                        style={{ fontSize: 10, fill: COR.texto }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Cartao>

            <Cartao titulo="Atividades no CRM por vendedor">
              <div className="h-56 text-aura-graphite-soft">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porVendedor} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={COR.grade} vertical={false} />
                    <XAxis dataKey="nome" tick={{ fontSize: 11, fill: COR.texto }} interval={0} />
                    <YAxis tick={{ fontSize: 11, fill: COR.texto }} allowDecimals={false} />
                    <Tooltip content={<Dica />} />
                    <Bar dataKey="atividades" name="Atividades" fill={COR.serie} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="atividades" position="top" style={{ fontSize: 10, fill: COR.texto }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Cartao>

            <Cartao titulo="Conversas e alertas por vendedor">
              <div className="h-56 text-aura-graphite-soft">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porVendedor} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={COR.grade} vertical={false} />
                    <XAxis dataKey="nome" tick={{ fontSize: 11, fill: COR.texto }} interval={0} />
                    <YAxis tick={{ fontSize: 11, fill: COR.texto }} allowDecimals={false} />
                    <Tooltip content={<Dica />} />
                    <Bar dataKey="conversas" name="Conversas" fill={COR.serie} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="alertas" name="Com alerta" fill={COR.alerta} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Cartao>
          </div>

          {ind && (
            <IndicadoresDetalhados
              r={ind.atual}
              anterior={ind.anterior.geral}
              gestor={ind.gestor}
              mostrarEquipe={ind.gestor && ind.atual.porVendedor.length > 1}
              titulo="Indicadores do time de vendas"
              rotuloAnterior="vs semana anterior"
              quebrarPagina={false}
            />
          )}

          <div className="space-y-3">
            <h3 className="font-display text-base font-semibold text-aura-graphite">
              Vendedor por vendedor
            </h3>
            {r.vendedores.map((v) => (
              <BlocoDoVendedor
                // Semana na chave: trocar de período recomeça aberto/fechado.
                key={`${r.periodoInicio}|${r.periodoFim}|${v.vendedorId}`}
                v={v}
                comLaudo={!!dados?.gestor}
                abertoInicial={r.vendedores.length <= 4}
                indicadores={ind?.atual.porVendedor.find((x) => x.id === v.vendedorId)}
                mes={ind?.atual.mes}
              />
            ))}
          </div>

          {r.lacunas.length ? (
            <Cartao titulo="O que este relatório não mede">
              <ul className="space-y-1">
                {r.lacunas.map((l, i) => (
                  <li key={i} className="flex gap-1.5 text-xs text-aura-graphite-soft">
                    <span className="mt-[0.35rem] h-1 w-1 shrink-0 rounded-full bg-aura-graphite-soft" />
                    {l}
                  </li>
                ))}
              </ul>
            </Cartao>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
