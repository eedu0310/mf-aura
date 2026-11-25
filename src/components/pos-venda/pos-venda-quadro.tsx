"use client";

import { CalendarDays, Clock } from "lucide-react";
import type { PosVenda } from "@/lib/supabase/pos-venda";
import { Selo } from "@/components/ui";
import { Sinais } from "./pos-venda-pecas";
import {
  COLUNAS,
  diasEntre,
  estaAtrasada,
  formatarDia,
  formatarHora,
  formatarMoeda,
  haQuantoTempo,
  temReclamacaoAberta,
} from "./regras";

/**
 * Ordem dos cards dentro da coluna. Com data marcada, a instalação mais
 * próxima vem primeiro; sem data, fica a ordem do banco (mais recente antes).
 */
function ordenarColuna(itens: PosVenda[]) {
  return [...itens].sort((a, b) => {
    if (a.dataAgendamento && b.dataAgendamento) {
      return `${a.dataAgendamento} ${a.horaAgendamento ?? ""}`.localeCompare(`${b.dataAgendamento} ${b.horaAgendamento ?? ""}`);
    }
    if (a.dataAgendamento) return -1;
    if (b.dataAgendamento) return 1;
    return 0;
  });
}

function CardPosVenda({
  item,
  hoje,
  mostrarLoja,
  aoAbrir,
}: {
  item: PosVenda;
  hoje: string;
  mostrarLoja: boolean;
  aoAbrir: (item: PosVenda) => void;
}) {
  const atrasada = estaAtrasada(item, hoje);
  const alerta = atrasada || temReclamacaoAberta(item);
  const clienteAntigo = item.origem === "cliente_antigo";
  const dias = diasEntre(item.dataVenda, hoje);

  return (
    <button
      type="button"
      onClick={() => aoAbrir(item)}
      className={`group flex w-full flex-col gap-1.5 rounded-lg border bg-aura-surface p-3 text-left shadow-sm transition hover:border-aura-petrol-500/40 hover:shadow focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-aura-petrol-500 ${
        alerta ? "border-aura-danger/50" : "border-aura-mist"
      }`}
    >
      <span className="flex min-w-0 items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-aura-graphite group-hover:text-aura-petrol-600">
            {item.cliente}
          </span>
          {item.produto && <span className="block truncate text-xs text-aura-graphite-soft">{item.produto}</span>}
        </span>
        {clienteAntigo ? (
          <Selo tom="ouro" className="shrink-0">
            Antigo
          </Selo>
        ) : (
          item.valor > 0 && (
            <span className="shrink-0 text-xs font-semibold tabular-nums text-aura-graphite">{formatarMoeda(item.valor)}</span>
          )
        )}
      </span>

      <span className="flex flex-wrap items-center justify-between gap-1.5">
        {item.dataAgendamento ? (
          <span
            className={`flex items-center gap-1 text-[0.6875rem] tabular-nums ${atrasada ? "font-medium text-aura-danger" : "text-aura-graphite-soft"}`}
          >
            <CalendarDays size={11} className="shrink-0" aria-hidden />
            {formatarDia(item.dataAgendamento, true)}
            {item.horaAgendamento ? ` · ${formatarHora(item.horaAgendamento)}` : ""}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[0.6875rem] text-aura-graphite-soft">
            <Clock size={11} className="shrink-0" aria-hidden />
            {clienteAntigo ? "Marcado" : "Venda"} {haQuantoTempo(dias)}
          </span>
        )}
        {mostrarLoja && <Selo className="max-w-[8rem] truncate">{item.empresa}</Selo>}
      </span>

      <Sinais item={item} hoje={hoje} />
    </button>
  );
}

/**
 * O quadro: uma coluna por etapa. A mudança de etapa continua sendo feita no
 * modal do pós-venda (o quadro não arrasta). No celular as colunas rolam de
 * lado; na tela larga as seis cabem juntas.
 */
export function PosVendaQuadro({
  itens,
  hoje,
  mostrarLoja,
  aoAbrir,
}: {
  itens: PosVenda[];
  hoje: string;
  mostrarLoja: boolean;
  aoAbrir: (item: PosVenda) => void;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:mx-0 xl:px-0">
      <div className="flex snap-x snap-mandatory gap-3 xl:snap-none">
        {COLUNAS.map((coluna) => {
          const itensColuna = ordenarColuna(itens.filter((i) => i.status === coluna.status));
          return (
            <section
              key={coluna.status}
              aria-label={`${coluna.titulo}: ${itensColuna.length}`}
              className="flex w-[16.5rem] shrink-0 snap-start flex-col gap-2 rounded-xl border border-aura-mist bg-aura-sunken/50 p-2.5 xl:w-auto xl:min-w-0 xl:flex-1"
            >
              <header className="px-1 pt-0.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-aura-graphite">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${coluna.cor}`} aria-hidden />
                    <span className="truncate">{coluna.titulo}</span>
                  </h3>
                  <span className="rounded-md bg-aura-surface px-1.5 py-0.5 text-xs tabular-nums text-aura-graphite-soft">
                    {itensColuna.length}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[0.6875rem] text-aura-graphite-soft" title={coluna.dica}>
                  {coluna.dica}
                </p>
              </header>

              <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
                {itensColuna.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-aura-mist px-3 py-5 text-center text-xs text-aura-graphite-soft">
                    Nenhuma venda aqui
                  </p>
                ) : (
                  itensColuna.map((item) => (
                    <CardPosVenda key={item.id} item={item} hoje={hoje} mostrarLoja={mostrarLoja} aoAbrir={aoAbrir} />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
