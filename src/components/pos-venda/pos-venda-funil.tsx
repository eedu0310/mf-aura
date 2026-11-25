"use client";

import { GitBranch } from "lucide-react";
import type { PosVenda } from "@/lib/supabase/pos-venda";
import { CardHeader } from "@/components/ui";
import { ehVenda } from "./regras";
import { instalacaoConcluida, manutencaoVencida, type ItemManutencao } from "./regras-manutencao";

interface Etapa {
  titulo: string;
  valor: number;
  /** Com quem a etapa se compara (para a % e para quem ficou para trás). */
  base: number;
  rotuloBase: string;
  /** O que aconteceu com quem não chegou nesta etapa. */
  perda: string;
}

/**
 * O funil da jornada inteira depois da venda:
 *
 *   Venda fechada → Instalação agendada → Instalada → Avaliada
 *                                                   → Manutenção em dia
 *
 * Só vendas (cliente antigo não é venda: fica fora, como nas outras métricas).
 * "Avaliada" e "Manutenção em dia" se comparam com as instaladas — uma não
 * depende da outra. Quem foi instalado chegou também no agendamento, mesmo
 * que a data nunca tenha sido anotada.
 */
function calcular(itens: PosVenda[], manutencoes: ItemManutencao[], hoje: string): Etapa[] {
  const vendas = itens.filter(ehVenda);
  const comLimpezaVencida = new Set(manutencoes.filter((m) => manutencaoVencida(m, hoje)).map((m) => m.posVenda.id));

  const instaladas = vendas.filter(instalacaoConcluida);
  const agendadas = vendas.filter(
    (i) =>
      instalacaoConcluida(i) ||
      Boolean(i.dataAgendamento || i.instalacaoAgendadaEm) ||
      i.status !== "aguardando_instalacao"
  );
  const avaliadas = instaladas.filter((i) => i.avaliouLoja);
  const emDia = instaladas.filter((i) => !comLimpezaVencida.has(i.id));

  const n = vendas.length;
  return [
    { titulo: "Venda fechada", valor: n, base: n, rotuloBase: "das vendas", perda: "" },
    {
      titulo: "Instalação agendada",
      valor: agendadas.length,
      base: n,
      rotuloBase: "das vendas",
      perda: "ainda sem data",
    },
    {
      titulo: "Instalada / concluída",
      valor: instaladas.length,
      base: agendadas.length,
      rotuloBase: "das agendadas",
      perda: "esperando a instalação",
    },
    {
      titulo: "Avaliada",
      valor: avaliadas.length,
      base: instaladas.length,
      rotuloBase: "das instaladas",
      perda: "sem avaliação",
    },
    {
      titulo: "Manutenção em dia",
      valor: emDia.length,
      base: instaladas.length,
      rotuloBase: "das instaladas",
      perda: "com limpeza vencida",
    },
  ];
}

export function PosVendaFunil({
  itens,
  manutencoes,
  hoje,
}: {
  itens: PosVenda[];
  manutencoes: ItemManutencao[];
  hoje: string;
}) {
  const etapas = calcular(itens, manutencoes, hoje);
  const total = etapas[0].valor;

  return (
    <section className="aura-card p-4 sm:p-5" aria-labelledby="pv-funil-titulo">
      <CardHeader
        titulo={<span id="pv-funil-titulo">Funil do pós-venda</span>}
        descricao="Por onde cada venda já passou, da venda fechada à manutenção. Clientes antigos ficam fora."
        icone={GitBranch}
      />
      {total === 0 ? (
        <p className="py-4 text-sm text-aura-graphite-soft">Nenhuma venda nesta seleção ainda.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {etapas.map((e, i) => {
            const largura = total > 0 ? Math.max((e.valor / total) * 100, e.valor > 0 ? 2 : 0) : 0;
            const pct = e.base > 0 ? Math.round((e.valor / e.base) * 100) : null;
            const ficaram = e.base - e.valor;
            return (
              <li key={e.titulo} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[11rem_minmax(0,1fr)_7.5rem]">
                <span className="flex min-w-0 items-center gap-2 text-sm text-aura-graphite">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-aura-sunken text-[0.6875rem] font-semibold tabular-nums text-aura-graphite-soft">
                    {i + 1}
                  </span>
                  <span className="truncate">{e.titulo}</span>
                </span>
                <span className="text-right text-sm font-semibold tabular-nums text-aura-graphite sm:order-last">
                  {e.valor}
                  {i > 0 && pct !== null && (
                    <span className="ml-1.5 text-xs font-normal text-aura-graphite-soft">{pct}%</span>
                  )}
                </span>
                <span className="col-span-2 flex min-w-0 flex-col gap-1 sm:col-span-1">
                  <span className="h-2.5 overflow-hidden rounded-full bg-aura-sunken" aria-hidden>
                    <span
                      className={`block h-full rounded-full ${i === etapas.length - 1 ? "bg-aura-success" : "bg-aura-petrol-500"}`}
                      style={{ width: `${largura}%` }}
                    />
                  </span>
                  {i > 0 && (
                    <span className="text-[0.6875rem] text-aura-graphite-soft">
                      {ficaram > 0 ? (
                        <>
                          <span className="font-medium text-aura-gold-700">−{ficaram}</span> {e.perda}
                          <span className="hidden sm:inline"> · {pct}% {e.rotuloBase}</span>
                        </>
                      ) : e.base > 0 ? (
                        `todas ${e.rotuloBase.replace(/^das /, "as ")} chegaram aqui`
                      ) : (
                        "—"
                      )}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
