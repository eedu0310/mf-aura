"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import type { PosVenda } from "@/lib/supabase/pos-venda";
import { Selo } from "@/components/ui";
import { Nota, SeloStatus, Sinais } from "./pos-venda-pecas";
import { ORDEM_STATUS, estaAtrasada, formatarDia, formatarHora, formatarMoeda } from "./regras";

type Coluna = "cliente" | "empresa" | "status" | "venda" | "agendamento" | "valor" | "nota";
type Ordem = { coluna: Coluna; sentido: "asc" | "desc" };

/** Valor de cada coluna para ordenar. Vazio vai sempre para o fim. */
function chave(item: PosVenda, coluna: Coluna): string | number | null {
  switch (coluna) {
    case "cliente":
      return item.cliente.toLocaleLowerCase("pt-BR");
    case "empresa":
      return item.empresa.toLocaleLowerCase("pt-BR");
    case "status":
      return ORDEM_STATUS[item.status] ?? 99;
    case "venda":
      return item.dataVenda || null;
    case "agendamento":
      return item.dataAgendamento ? `${item.dataAgendamento} ${item.horaAgendamento ?? ""}` : null;
    case "valor":
      return item.origem === "cliente_antigo" ? null : item.valor;
    case "nota":
      return item.avaliouLoja && item.notaAvaliacao ? item.notaAvaliacao : null;
  }
}

function ordenar(itens: PosVenda[], { coluna, sentido }: Ordem) {
  const fator = sentido === "asc" ? 1 : -1;
  return [...itens].sort((a, b) => {
    const va = chave(a, coluna);
    const vb = chave(b, coluna);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * fator;
    return String(va).localeCompare(String(vb), "pt-BR") * fator;
  });
}

function Cabecalho({
  coluna,
  ordem,
  aoOrdenar,
  children,
  className = "",
}: {
  coluna: Coluna;
  ordem: Ordem;
  aoOrdenar: (c: Coluna) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const ativa = ordem.coluna === coluna;
  const Seta = ordem.sentido === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      className={className}
      aria-sort={ativa ? (ordem.sentido === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => aoOrdenar(coluna)}
        className={`inline-flex items-center gap-1 uppercase tracking-[0.05em] hover:text-aura-graphite ${ativa ? "text-aura-graphite" : ""}`}
      >
        {children}
        {ativa && <Seta size={11} aria-hidden />}
      </button>
    </th>
  );
}

function Agendamento({ item, hoje }: { item: PosVenda; hoje: string }) {
  if (!item.dataAgendamento) return <span className="text-aura-graphite-soft">—</span>;
  const atrasada = estaAtrasada(item, hoje);
  return (
    <span className={`tabular-nums ${atrasada ? "font-medium text-aura-danger" : ""}`}>
      {formatarDia(item.dataAgendamento)}
      {item.horaAgendamento && <span className="text-aura-graphite-soft"> {formatarHora(item.horaAgendamento)}</span>}
    </span>
  );
}

/**
 * A lista: uma linha por pós-venda, para quem quer ver tudo de uma vez e
 * ordenar por qualquer coluna. No celular cada linha vira um cartão.
 */
export function PosVendaLista({
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
  const [ordem, setOrdem] = useState<Ordem>({ coluna: "venda", sentido: "desc" });
  const ordenados = useMemo(() => ordenar(itens, ordem), [itens, ordem]);

  function aoOrdenar(coluna: Coluna) {
    setOrdem((atual) =>
      atual.coluna === coluna
        ? { coluna, sentido: atual.sentido === "asc" ? "desc" : "asc" }
        : // Datas, valor e nota começam do maior; texto e etapa, de A a Z.
          { coluna, sentido: ["venda", "valor", "nota"].includes(coluna) ? "desc" : "asc" }
    );
  }

  const props = { ordem, aoOrdenar };

  return (
    <>
      {/* Tela larga: tabela */}
      <div className="aura-card hidden overflow-hidden md:block">
        <div className="max-h-[70vh] overflow-auto">
          <table className="aura-tabela">
            <thead>
              <tr>
                <Cabecalho coluna="cliente" {...props}>Cliente</Cabecalho>
                {mostrarLoja && <Cabecalho coluna="empresa" {...props}>Loja</Cabecalho>}
                <Cabecalho coluna="status" {...props}>Etapa</Cabecalho>
                <Cabecalho coluna="venda" {...props}>Venda</Cabecalho>
                <Cabecalho coluna="agendamento" {...props}>Instalação</Cabecalho>
                <Cabecalho coluna="valor" {...props} className="text-right">Valor</Cabecalho>
                <Cabecalho coluna="nota" {...props}>Nota</Cabecalho>
                <th scope="col">Pendências</th>
              </tr>
            </thead>
            <tbody>
              {ordenados.map((item) => (
                <tr key={item.id} onClick={() => aoAbrir(item)} className="cursor-pointer">
                  <td className="max-w-[16rem]">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        aoAbrir(item);
                      }}
                      className="block max-w-full truncate text-left font-medium text-aura-graphite hover:text-aura-petrol-600"
                    >
                      {item.cliente}
                    </button>
                    {item.produto && <span className="block truncate text-xs text-aura-graphite-soft">{item.produto}</span>}
                  </td>
                  {mostrarLoja && <td className="whitespace-nowrap text-aura-graphite-soft">{item.empresa}</td>}
                  <td>
                    <SeloStatus item={item} />
                  </td>
                  <td className="whitespace-nowrap tabular-nums text-aura-graphite-soft">{formatarDia(item.dataVenda)}</td>
                  <td className="whitespace-nowrap">
                    <Agendamento item={item} hoje={hoje} />
                  </td>
                  <td className="whitespace-nowrap text-right tabular-nums">
                    {item.origem === "cliente_antigo" ? (
                      <Selo tom="ouro">Cliente antigo</Selo>
                    ) : (
                      formatarMoeda(item.valor)
                    )}
                  </td>
                  <td>
                    {item.avaliouLoja && item.notaAvaliacao ? (
                      <Nota valor={item.notaAvaliacao} />
                    ) : (
                      <span className="text-xs text-aura-graphite-soft">{item.avaliouLoja ? "Avaliou" : "—"}</span>
                    )}
                  </td>
                  <td>
                    <Sinais item={item} hoje={hoje} semNota />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Celular: cartões */}
      <ul className="flex flex-col gap-2 md:hidden">
        {ordenados.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => aoAbrir(item)}
              className="aura-card aura-card-interativo flex w-full items-center gap-3 p-3.5 text-left"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-aura-graphite">{item.cliente}</span>
                    {item.produto && <span className="block truncate text-xs text-aura-graphite-soft">{item.produto}</span>}
                  </span>
                  {item.origem !== "cliente_antigo" && (
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-aura-graphite">{formatarMoeda(item.valor)}</span>
                  )}
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <SeloStatus item={item} />
                  {item.origem === "cliente_antigo" && item.status !== "cliente_antigo" && (
                    <Selo tom="ouro">Cliente antigo</Selo>
                  )}
                  {mostrarLoja && <Selo>{item.empresa}</Selo>}
                  <Sinais item={item} hoje={hoje} />
                </span>
                <span className="flex flex-wrap gap-x-3 text-xs text-aura-graphite-soft">
                  <span>Venda {formatarDia(item.dataVenda)}</span>
                  {item.dataAgendamento && (
                    <span>
                      Instalação <Agendamento item={item} hoje={hoje} />
                    </span>
                  )}
                </span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-aura-graphite-soft" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
