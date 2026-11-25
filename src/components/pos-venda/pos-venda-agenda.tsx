"use client";

import { CalendarCheck2, CalendarClock, CalendarDays, CalendarOff, CalendarRange } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PosVenda } from "@/lib/supabase/pos-venda";
import { Botao, CardHeader, EstadoVazio, Selo } from "@/components/ui";
import { SeloStatus, Sinais } from "./pos-venda-pecas";
import {
  INSTALACAO_ABERTA,
  diaDaSemana,
  diasEntre,
  formatarHora,
  haQuantoTempo,
  somarDias,
} from "./regras";

type Grupo = "atrasadas" | "hoje" | "semana" | "depois" | "sem_data";

const GRUPOS: { chave: Grupo; titulo: string; descricao: string; icone: LucideIcon; cor: string }[] = [
  {
    chave: "atrasadas",
    // "Data vencida", e não "Atrasadas": aqui entra toda instalação em aberto
    // com a data no passado (inclusive as pendentes de reagendar), enquanto o
    // número "Atrasadas" do topo conta só as agendadas. Nomes iguais com
    // contagens diferentes confundiam.
    titulo: "Data vencida",
    descricao: "A data passou e a instalação ainda não foi concluída (inclui as pendentes de reagendar)",
    icone: CalendarClock,
    cor: "text-aura-danger",
  },
  { chave: "hoje", titulo: "Hoje", descricao: "Instalações marcadas para hoje", icone: CalendarCheck2, cor: "text-aura-petrol-600" },
  { chave: "semana", titulo: "Próximos 7 dias", descricao: "O que vem pela frente", icone: CalendarRange, cor: "text-aura-petrol-600" },
  { chave: "depois", titulo: "Depois", descricao: "Mais de uma semana adiante", icone: CalendarDays, cor: "text-aura-graphite-soft" },
  {
    chave: "sem_data",
    titulo: "Sem data",
    descricao: "Vendas esperando agendamento, da mais antiga para a mais nova",
    icone: CalendarOff,
    cor: "text-aura-gold-700",
  },
];

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function grupoDe(item: PosVenda, hoje: string, emUmaSemana: string): Grupo {
  const dia = item.dataAgendamento;
  if (!dia) return "sem_data";
  if (dia < hoje) return "atrasadas";
  if (dia === hoje) return "hoje";
  if (dia <= emUmaSemana) return "semana";
  return "depois";
}

function Linha({
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
  const dia = item.dataAgendamento;
  const [, mes, d] = dia ? dia.split("-") : [];
  const atraso = dia && dia < hoje ? diasEntre(dia, hoje) : null;

  return (
    <li className="flex items-center gap-3 py-2.5">
      {/* Quadradinho com o dia, como numa agenda de papel */}
      <span
        className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border text-center leading-none ${
          atraso ? "border-aura-danger/40 bg-aura-danger/5" : "border-aura-mist bg-aura-sunken/60"
        }`}
        aria-hidden
      >
        {dia ? (
          <>
            <span className={`text-[0.625rem] uppercase ${atraso ? "text-aura-danger" : "text-aura-graphite-soft"}`}>
              {diaDaSemana(dia)}
            </span>
            <span className={`mt-0.5 text-sm font-semibold tabular-nums ${atraso ? "text-aura-danger" : "text-aura-graphite"}`}>
              {d}
            </span>
            <span className="text-[0.5625rem] uppercase text-aura-graphite-soft">{MESES[Number(mes) - 1]}</span>
          </>
        ) : (
          <span className="text-xs text-aura-graphite-soft">—</span>
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm font-medium text-aura-graphite">{item.cliente}</span>
          {item.horaAgendamento && (
            <span className="shrink-0 text-xs tabular-nums text-aura-graphite-soft">{formatarHora(item.horaAgendamento)}</span>
          )}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-aura-graphite-soft">
          {item.produto && <span className="max-w-[14rem] truncate">{item.produto}</span>}
          <SeloStatus item={item} />
          {mostrarLoja && <Selo>{item.empresa}</Selo>}
          {atraso !== null && <span className="font-medium text-aura-danger">{atraso} dia{atraso === 1 ? "" : "s"} de atraso</span>}
          {!dia && <span>venda {haQuantoTempo(diasEntre(item.dataVenda, hoje))}</span>}
          <Sinais item={item} hoje={hoje} semNota />
        </p>
      </div>

      <Botao tamanho="sm" onClick={() => aoAbrir(item)} aria-label={`Abrir ${item.cliente}`}>
        {dia ? "Abrir" : "Agendar"}
      </Botao>
    </li>
  );
}

/**
 * A agenda de instalações: só o que ainda não foi instalado (aguardando,
 * agendada e pendente), separado por quando acontece. Reclamação e concluído
 * ficam de fora porque a instalação já passou.
 */
export function PosVendaAgenda({
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
  const emUmaSemana = somarDias(hoje, 7);
  const abertas = itens.filter((i) => INSTALACAO_ABERTA.includes(i.status));

  if (abertas.length === 0) {
    return (
      <EstadoVazio
        icone={CalendarCheck2}
        titulo="Nenhuma instalação em aberto"
        descricao="Todas as vendas desta seleção já foram instaladas. Reclamações e concluídas aparecem no quadro e na lista."
      />
    );
  }

  const porGrupo = new Map<Grupo, PosVenda[]>(GRUPOS.map((g) => [g.chave, []]));
  for (const item of abertas) porGrupo.get(grupoDe(item, hoje, emUmaSemana))!.push(item);
  for (const [chave, lista] of porGrupo) {
    lista.sort((a, b) =>
      chave === "sem_data"
        ? (a.dataVenda || "").localeCompare(b.dataVenda || "")
        : `${a.dataAgendamento} ${a.horaAgendamento ?? ""}`.localeCompare(`${b.dataAgendamento} ${b.horaAgendamento ?? ""}`)
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {GRUPOS.map((g) => {
        const lista = porGrupo.get(g.chave)!;
        // "Hoje" aparece sempre, mesmo vazio; os outros só quando têm algo.
        if (lista.length === 0 && g.chave !== "hoje") return null;
        return (
          <section key={g.chave} className={`aura-card p-4 ${g.chave === "atrasadas" ? "border-aura-danger/40" : ""}`}>
            <CardHeader
              titulo={
                <>
                  {g.titulo}
                  <span className="ml-1.5 font-normal tabular-nums text-aura-graphite-soft">{lista.length}</span>
                </>
              }
              descricao={g.descricao}
              icone={g.icone}
              corIcone={g.cor}
              className="mb-1"
            />
            {lista.length === 0 ? (
              <p className="py-3 text-sm text-aura-graphite-soft">Nenhuma instalação marcada para hoje.</p>
            ) : (
              <ul className="max-h-[28rem] divide-y divide-aura-mist overflow-y-auto">
                {lista.map((item) => (
                  <Linha key={item.id} item={item} hoje={hoje} mostrarLoja={mostrarLoja} aoAbrir={aoAbrir} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
