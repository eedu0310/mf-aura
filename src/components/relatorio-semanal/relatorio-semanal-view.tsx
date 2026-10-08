"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  MessageSquare,
  Printer,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import type { RelatorioSemanal, VendedorNoRelatorio } from "@/lib/relatorio-semanal/gerar";

/* Mesma paleta do Relatório do Período, para os dois relatórios parecerem
   do mesmo sistema quando o gestor imprime os dois juntos. */
const COR = { serie: "#2a78d6", serie2: "#1baf7a", alerta: "#c2410c", grade: "#e7e5e4", texto: "#52514e" };

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
    <div className="rounded-xl border border-aura-mist bg-white p-3" data-cartao>
      <div className="flex items-center gap-1.5 text-aura-graphite-soft">
        {icone}
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 font-display text-xl font-semibold text-aura-graphite">{valor}</p>
      {sub ? <p className="text-[11px] text-aura-graphite-soft">{sub}</p> : null}
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
    <section className={`rounded-xl border border-aura-mist bg-white p-4 ${className}`} data-cartao>
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

function Dica({ active, payload, label, formato }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-aura-mist bg-white px-2.5 py-1.5 text-xs shadow-sm">
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
          <p className="font-display text-xl font-bold text-aura-graphite">Relatório semanal</p>
          <p className="text-[11px] text-aura-graphite-soft">AURA · Grupo MF</p>
        </div>
        <div className="text-right text-[11px] text-aura-graphite-soft">
          <p>
            <strong className="text-aura-graphite">Loja:</strong> {r.empresa}
          </p>
          <p>
            <strong className="text-aura-graphite">Semana:</strong> {dataBR(r.periodoInicio)} a{" "}
            {dataBR(r.periodoFim)}
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
      <div className="rounded-lg border border-aura-mist bg-aura-bg px-3 py-2 text-xs text-aura-graphite-soft">
        {a.resumo}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {a.resumo ? <p className="text-xs leading-relaxed text-aura-graphite">{a.resumo}</p> : null}

      {a.acertos.length ? (
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-aura-graphite-soft">
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
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-aura-graphite-soft">
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
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-aura-graphite-soft">
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
        <tr className="text-left text-[11px] uppercase tracking-wide text-aura-graphite-soft">
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

function BlocoDoVendedor({
  v,
  abertoInicial,
}: {
  v: VendedorNoRelatorio;
  abertoInicial: boolean;
}) {
  const [aberto, setAberto] = useState(abertoInicial);

  return (
    <section className="rounded-xl border border-aura-mist bg-white" data-cartao>
      <button
        type="button"
        onClick={() => setAberto((x) => !x)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left print:cursor-auto"
        aria-expanded={aberto}
      >
        <span className="text-aura-graphite-soft print:hidden">
          {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-base font-semibold text-aura-graphite">
            {v.nome}
          </span>
          <span className="block text-[11px] text-aura-graphite-soft">{v.cargo}</span>
        </span>
        <span className="hidden shrink-0 gap-4 text-right sm:flex print:flex">
          <span>
            <span className="block text-[10px] uppercase tracking-wide text-aura-graphite-soft">
              Vendido
            </span>
            <span className="block text-sm font-semibold text-aura-graphite">
              {moedaCurta(v.vendas.valor)}
            </span>
          </span>
          <span>
            <span className="block text-[10px] uppercase tracking-wide text-aura-graphite-soft">
              CRM
            </span>
            <span className="block text-sm font-semibold text-aura-graphite">{v.crm.atividades}</span>
          </span>
          <span>
            <span className="block text-[10px] uppercase tracking-wide text-aura-graphite-soft">
              Conversas
            </span>
            <span className="block text-sm font-semibold text-aura-graphite">
              {v.atendimento.conversasAtivas}
            </span>
          </span>
          <span>
            <span className="block text-[10px] uppercase tracking-wide text-aura-graphite-soft">
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
          <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-aura-graphite-soft">
                O que ele fez no CRM
              </p>
              <Barras itens={v.crm.porTipo.map((t) => ({ rotulo: t.tipo, valor: t.n }))} />
              <p className="mt-2 text-[11px] text-aura-graphite-soft">
                {v.crm.visitas} visitas · {v.crm.ligacoes} ligações · {v.crm.orcamentos} orçamentos ·{" "}
                {v.crm.followUps} follow-ups
              </p>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-aura-graphite-soft">
                Prospecção por tipo de cliente
              </p>
              <Barras
                itens={v.prospeccao.porCategoria.map((c) => ({
                  rotulo: c.categoria,
                  valor: c.atividades,
                  nota: c.clientesNovos ? `${c.clientesNovos} novo(s)` : undefined,
                }))}
              />
              <p className="mt-2 text-[11px] text-aura-graphite-soft">
                {v.prospeccao.clientesNovos} cliente(s) cadastrado(s) na semana
              </p>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-aura-graphite-soft">
                Pipeline dele
              </p>
              <Barras
                itens={v.pipeline.porEtapa.map((e) => ({
                  rotulo: e.etapa,
                  valor: e.negocios,
                  nota: moedaCurta(e.valor),
                }))}
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
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-aura-graphite-soft">
                Meta do mês contra a semana
              </p>
              <MetasDoVendedor v={v} />
            </div>
          </div>

          <div className="rounded-lg border border-aura-mist bg-aura-bg p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-aura-graphite-soft">
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

  async function gerarAgora() {
    setGerando(true);
    setErro(null);
    try {
      const resp = await fetch("/api/relatorios/semanal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loja: loja ?? dados?.loja, periodo }),
      });
      const j = await resp.json();
      if (!resp.ok) setErro(j.erro ?? "Não consegui gerar o relatório.");
      else await buscar();
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
            className="rounded-full border border-aura-mist bg-white px-3 py-1.5 text-sm text-aura-graphite"
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
            value={periodo ?? dados.periodos[0].periodo_inicio}
            onChange={(e) => setPeriodo(e.target.value)}
            className="rounded-full border border-aura-mist bg-white px-3 py-1.5 text-sm text-aura-graphite"
            aria-label="Semana"
          >
            {dados.periodos.map((p) => (
              <option key={p.periodo_inicio} value={p.periodo_inicio}>
                {dataBR(p.periodo_inicio)} a {dataBR(p.periodo_fim)}
              </option>
            ))}
          </select>
        ) : null}

        {dados?.podeGerar ? (
          <button
            type="button"
            onClick={gerarAgora}
            disabled={gerando}
            className="flex items-center gap-1.5 rounded-full border border-aura-mist bg-white px-3 py-1.5 text-sm text-aura-graphite hover:bg-aura-bg disabled:opacity-60"
          >
            {gerando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {gerando ? "Gerando..." : "Gerar esta semana agora"}
          </button>
        ) : null}

        {r ? (
          <button
            type="button"
            onClick={imprimir}
            className="flex items-center gap-1.5 rounded-full bg-aura-petrol-700 px-3 py-1.5 text-sm text-white hover:bg-aura-petrol-600"
          >
            <Printer className="h-4 w-4" />
            Imprimir / PDF
          </button>
        ) : null}
      </div>

      {erro ? (
        <p className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
          {erro}
        </p>
      ) : null}

      {dados?.textoAntigo ? (
        <Cartao titulo="Relatório desta semana (formato antigo)">
          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-aura-graphite">
            {dados.textoAntigo}
          </pre>
        </Cartao>
      ) : null}

      {!r && !dados?.textoAntigo && !erro ? (
        <div className="rounded-xl border border-aura-mist bg-white px-4 py-8 text-center" data-cartao>
          <p className="text-sm text-aura-graphite">Nenhum relatório semanal gerado ainda.</p>
          <p className="mt-1 text-xs text-aura-graphite-soft">
            O relatório é gerado automaticamente todo sábado às 16h.
            {dados?.podeGerar ? " Você também pode gerar o desta semana agora, pelo botão acima." : ""}
          </p>
        </div>
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
              <div className="h-56">
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
              <div className="h-56">
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
              <div className="h-56">
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
              <div className="h-56">
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

          <div className="space-y-3">
            <h3 className="font-display text-base font-semibold text-aura-graphite">
              Vendedor por vendedor
            </h3>
            {r.vendedores.map((v) => (
              <BlocoDoVendedor key={v.vendedorId} v={v} abertoInicial={r.vendedores.length <= 4} />
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
