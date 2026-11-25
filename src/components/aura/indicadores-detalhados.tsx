"use client";

import {
  Ban,
  CalendarClock,
  DollarSign,
  Percent,
  Receipt,
  Scale,
  Search,
  Smile,
  Target,
} from "lucide-react";
import type { Indicadores, RelatorioDetalhado } from "@/lib/aura/relatorio-detalhado";

const moeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const moedaCurta = (v: number) =>
  v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")} mi`
    : v >= 1000
      ? `R$ ${Math.round(v / 1000)} mil`
      : `R$ ${Math.round(v)}`;
const pct = (v: number | null, casas = 0) =>
  v == null ? "—" : `${v.toFixed(casas).replace(".", ",")}%`;
const dias = (v: number | null) => (v == null ? "—" : v === 1 ? "1 dia" : `${v} dias`);
const nota = (v: number | null) => (v == null ? "—" : `${v.toFixed(1).replace(".", ",")} / 5`);

const NOME_MES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const nomeDoMes = (mes: string) => NOME_MES[Number(mes.slice(5, 7)) - 1] ?? mes;

/** Cor da meta: verde bateu, âmbar no caminho, vermelho longe. */
function tomMeta(v: number | null) {
  if (v == null) return "text-aura-graphite-soft";
  if (v >= 100) return "text-aura-success";
  if (v >= 70) return "text-aura-gold-700";
  return "text-aura-danger";
}
function corBarra(v: number) {
  if (v >= 100) return "var(--aura-success)";
  if (v >= 70) return "var(--aura-gold)";
  return "var(--aura-danger)";
}

function Indicador({
  n,
  icone,
  titulo,
  valor,
  detalhe,
  tom = "text-aura-graphite",
}: {
  n: number;
  icone: React.ReactNode;
  titulo: string;
  valor: string;
  detalhe?: React.ReactNode;
  tom?: string;
}) {
  return (
    <div data-cartao className="aura-card p-4 print:p-3">
      <div className="flex items-center gap-1.5 text-aura-graphite-soft">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-aura-sunken text-[10px] font-semibold tabular-nums">
          {n}
        </span>
        {icone}
        <span className="aura-rotulo leading-tight">{titulo}</span>
      </div>
      <p className={`mt-2 font-display text-2xl font-semibold tabular-nums print:text-xl ${tom}`}>{valor}</p>
      {detalhe && <p className="mt-1 text-xs leading-snug text-aura-graphite-soft">{detalhe}</p>}
    </div>
  );
}

function Cartoes({ g, mes }: { g: Indicadores; mes: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 print:grid-cols-3 print:gap-2">
      <Indicador
        n={1}
        icone={<DollarSign size={13} />}
        titulo="Receita"
        valor={moedaCurta(g.receita)}
        detalhe={`${g.vendas} venda(s) no período`}
      />
      <Indicador
        n={2}
        icone={<Search size={13} />}
        titulo="Prospecções"
        valor={String(g.prospeccoes)}
        detalhe={`negócios abertos · ${g.clientesNovos} cliente(s) novo(s)`}
      />
      <Indicador
        n={3}
        icone={<Percent size={13} />}
        titulo="Conversão"
        valor={g.conversao == null ? "—" : `${g.conversao}%`}
        detalhe={`${g.ganhos} ganho(s) · ${g.perdas} perdido(s)`}
      />
      <Indicador
        n={4}
        icone={<Receipt size={13} />}
        titulo="Ticket médio"
        valor={moedaCurta(g.ticket)}
        detalhe="receita ÷ vendas"
      />
      <Indicador
        n={5}
        icone={<Scale size={13} />}
        titulo="Margem (preço mantido)"
        valor={pct(g.precoMantido, 1)}
        detalhe={
          g.baseMargem
            ? `desconto médio ${pct(g.descontoMedio, 1)} · ${moeda(g.descontoTotal)} cedidos`
            : "nenhuma venda com preço de tabela"
        }
      />
      <Indicador
        n={6}
        icone={<CalendarClock size={13} />}
        titulo="Ciclo médio de venda"
        valor={dias(g.cicloMedio)}
        detalhe={
          g.baseCiclo
            ? `mediana ${dias(g.cicloMediana)} · ${g.cadastradasNoFechamento} de ${g.baseCiclo} cadastrada(s) só no fechamento`
            : "sem vendas para medir"
        }
      />
      <Indicador
        n={7}
        icone={<Ban size={13} />}
        titulo="Cancelamentos"
        valor={pct(g.taxaCancelamento, 1)}
        tom={g.canceladas ? "text-aura-danger" : "text-aura-graphite"}
        detalhe={g.canceladas ? `${g.canceladas} venda(s) desfeita(s)` : "nenhuma venda desfeita"}
      />
      <Indicador
        n={8}
        icone={<Target size={13} />}
        titulo={`Meta de ${nomeDoMes(mes)}`}
        valor={g.atingimento == null ? "—" : `${g.atingimento}%`}
        tom={tomMeta(g.atingimento)}
        detalhe={
          g.metaMes
            ? `${moedaCurta(g.vendidoMes)} de ${moedaCurta(g.metaMes)}`
            : "meta do mês não cadastrada"
        }
      />
      <Indicador
        n={9}
        icone={<Smile size={13} />}
        titulo="Satisfação do cliente"
        valor={nota(g.notaMedia)}
        detalhe={
          g.avaliacoes
            ? `${g.avaliacoes} avaliação(ões) · ${g.reclamacoes} reclamação(ões)`
            : `sem avaliações no período · ${g.reclamacoes} reclamação(ões)`
        }
      />
    </div>
  );
}

function TabelaVendedores({ r }: { r: RelatorioDetalhado }) {
  const linhas = r.porVendedor;
  return (
    <div data-cartao className="aura-card p-4 sm:p-5">
      <h3 className="mb-3 text-sm font-semibold text-aura-graphite">Indicadores por vendedor</h3>
      <div className="overflow-x-auto rounded-lg border border-aura-mist">
        <table className="aura-tabela min-w-[960px] tabular-nums print:!text-[7.5pt]">
          <thead>
            <tr>
              <th>Vendedor</th>
              <th className="!text-right">Receita</th>
              <th className="!text-right">Vendas</th>
              <th className="!text-right">Ticket</th>
              <th className="!text-right">Prosp.</th>
              <th className="!text-right">Conv.</th>
              <th className="!text-right">Margem</th>
              <th className="!text-right">Ciclo</th>
              <th className="!text-right">Cancel.</th>
              <th className="!text-right">Meta</th>
              <th className="!text-right">Satisf.</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((v) => (
              <tr key={v.id}>
                <td className="px-2 py-2 print:px-1 print:py-1">
                  <p className="font-medium text-aura-graphite">{v.nome}</p>
                  <p className="text-[11px] text-aura-graphite-soft">{v.loja}</p>
                </td>
                <td className="px-2 py-2 text-right font-medium print:px-1 print:py-1">{moeda(v.receita)}</td>
                <td className="px-2 py-2 text-right print:px-1 print:py-1">{v.vendas}</td>
                <td className="px-2 py-2 text-right print:px-1 print:py-1">{v.vendas ? moedaCurta(v.ticket) : "—"}</td>
                <td className="px-2 py-2 text-right print:px-1 print:py-1">{v.prospeccoes}</td>
                <td className="px-2 py-2 text-right print:px-1 print:py-1">{v.conversao == null ? "—" : `${v.conversao}%`}</td>
                <td className="px-2 py-2 text-right print:px-1 print:py-1">{pct(v.precoMantido, 1)}</td>
                <td className="px-2 py-2 text-right print:px-1 print:py-1">{v.cicloMedio == null ? "—" : `${v.cicloMedio} d`}</td>
                <td className={`px-2 py-2 text-right print:px-1 print:py-1 ${v.canceladas ? "text-aura-danger" : ""}`}>
                  {v.vendas ? pct(v.taxaCancelamento, 0) : "—"}
                </td>
                <td className={`px-2 py-2 text-right font-medium print:px-1 print:py-1 ${tomMeta(v.atingimento)}`}>
                  {v.atingimento == null ? "—" : `${v.atingimento}%`}
                </td>
                <td className="px-2 py-2 text-right print:px-1 print:py-1">
                  {v.notaMedia == null ? "—" : v.notaMedia.toFixed(1).replace(".", ",")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetasDoMes({ r }: { r: RelatorioDetalhado }) {
  const comMeta = r.porVendedor.filter((v) => v.metaMes);
  const semMeta = r.porVendedor.filter((v) => !v.metaMes);
  return (
    <div data-cartao className="aura-card p-4 sm:p-5">
      <h3 className="mb-3 text-sm font-semibold text-aura-graphite">
        Atingimento da meta de {nomeDoMes(r.mes)}
      </h3>
      {comMeta.length ? (
        <div className="space-y-2.5">
          {comMeta.map((v) => {
            const a = v.atingimento ?? 0;
            return (
              <div key={v.id}>
                <div className="mb-1 flex justify-between gap-3 text-xs">
                  <span className="truncate font-medium text-aura-graphite">{v.nome}</span>
                  <span className="shrink-0 tabular-nums text-aura-graphite-soft">
                    {moedaCurta(v.vendidoMes)} de {moedaCurta(v.metaMes!)} ·{" "}
                    <strong className={tomMeta(v.atingimento)}>{a}%</strong>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-aura-sunken">
                  <div
                    className="h-2 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(2, a))}%`, backgroundColor: corBarra(a) }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="py-4 text-sm text-aura-graphite-soft">Nenhuma meta cadastrada para este mês.</p>
      )}
      {semMeta.length > 0 && comMeta.length > 0 && (
        <p className="mt-3 text-xs text-aura-graphite-soft">
          Sem meta no mês: {semMeta.map((v) => v.nome).join(", ")}.
        </p>
      )}
    </div>
  );
}

function ComoCalculamos() {
  return (
    <div data-cartao className="aura-card p-4 text-xs leading-relaxed text-aura-graphite-soft sm:p-5">
      <h3 className="mb-2 text-sm font-semibold text-aura-graphite">Como cada número é calculado</h3>
      <ol className="grid gap-x-6 gap-y-1 sm:grid-cols-2 print:grid-cols-2">
        <li><strong className="text-aura-graphite">1. Receita:</strong> valor fechado das vendas do período; na venda em dupla, cada vendedor recebe a sua parte.</li>
        <li><strong className="text-aura-graphite">2. Prospecções:</strong> negócios abertos no período, mais os clientes novos cadastrados.</li>
        <li><strong className="text-aura-graphite">3. Conversão:</strong> ganhos ÷ (ganhos + perdidos). Negócio ainda em andamento não conta contra.</li>
        <li><strong className="text-aura-graphite">4. Ticket médio:</strong> receita ÷ número de vendas.</li>
        <li><strong className="text-aura-graphite">5. Margem:</strong> parte do preço de tabela mantida no fechamento. O custo dos produtos não está no sistema, então este é o quanto do preço o vendedor segurou na negociação.</li>
        <li><strong className="text-aura-graphite">6. Ciclo médio:</strong> dias entre o primeiro registro do cliente (ou do negócio) e a venda. Negócio cadastrado só no fechamento dá ciclo zero; registre desde o primeiro contato para o número ser real.</li>
        <li><strong className="text-aura-graphite">7. Cancelamentos:</strong> vendas do período que foram desfeitas (o negócio voltou para Perdidos) ÷ vendas do período.</li>
        <li><strong className="text-aura-graphite">8. Meta:</strong> vendido no mês corrente ÷ meta do mês cadastrada para cada vendedor.</li>
        <li><strong className="text-aura-graphite">9. Satisfação:</strong> nota média (1 a 5) que os clientes deram no pós-venda, e as reclamações abertas no período.</li>
        <li className="sm:col-span-2 print:col-span-2">Upsell e cross-sell não entram: cada cliente compra um sistema completo.</li>
      </ol>
    </div>
  );
}

/**
 * O relatório detalhado: os indicadores do time de vendas. Fica no Meu
 * Relatório, abaixo dos gráficos, e vai junto no Imprimir / PDF (começando
 * numa página nova, para não sair partido no meio).
 */
export function IndicadoresDetalhados({
  r,
  gestor,
  mostrarEquipe,
}: {
  r: RelatorioDetalhado;
  gestor: boolean;
  /** Tabela e metas por vendedor (gestor, sem filtro de um vendedor só). */
  mostrarEquipe: boolean;
}) {
  return (
    <section className="space-y-4 print:break-before-page">
      <div>
        <h2 className="font-display text-lg font-semibold text-aura-graphite">Relatório detalhado</h2>
        <p className="text-sm text-aura-graphite-soft">
          {gestor ? "Indicadores do time de vendas no período" : "Seus indicadores no período"}.
          A meta é sempre a do mês corrente.
        </p>
      </div>
      <Cartoes g={r.geral} mes={r.mes} />
      {mostrarEquipe && r.porVendedor.length > 0 && (
        <>
          <TabelaVendedores r={r} />
          <MetasDoMes r={r} />
        </>
      )}
      <ComoCalculamos />
    </section>
  );
}
