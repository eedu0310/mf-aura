"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, CalendarRange, Flame, HeartHandshake } from "lucide-react";
import Link from "next/link";
import { CardHeader, EstadoVazio, Selo } from "@/components/ui";
import { usePosVenda } from "./dados-pos-venda";
import { PosVendaKpis } from "./pos-venda-kpis";
import { PosVendaAtencao } from "./pos-venda-atencao";
import { PosVendaFunil } from "./pos-venda-funil";
import { EsqueletoPosVenda, SeloStatus } from "./pos-venda-pecas";
import { hrefDaSecao } from "./secoes";
import {
  INSTALACAO_ABERTA,
  diaDaSemana,
  diasEntre,
  formatarDia,
  formatarHora,
  somarDias,
  type Filtro,
} from "./regras";
import { ROTULO_TIPO } from "@/lib/supabase/pos-venda-manutencao";
import { dataDaManutencao, estaAberta } from "./regras-manutencao";

/** Quantas linhas cada cartão "o que vem pela frente" mostra. */
const LIMITE = 6;

function LinkVerTudo({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-aura-petrol-600 hover:underline">
      {children}
      <ArrowRight size={12} aria-hidden />
    </Link>
  );
}

/** Quadradinho com o dia, como numa agenda de papel. */
function Dia({ dia, vencido = false }: { dia: string; vencido?: boolean }) {
  return (
    <span
      className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg border text-center leading-none ${
        vencido ? "border-aura-danger/40 bg-aura-danger/5" : "border-aura-mist bg-aura-sunken/60"
      }`}
      aria-hidden
    >
      <span className={`text-[0.625rem] uppercase ${vencido ? "text-aura-danger" : "text-aura-graphite-soft"}`}>
        {diaDaSemana(dia)}
      </span>
      <span className={`mt-0.5 text-sm font-semibold tabular-nums ${vencido ? "text-aura-danger" : "text-aura-graphite"}`}>
        {dia.slice(8, 10)}
      </span>
    </span>
  );
}

/**
 * Visão geral: o resumo do pós-venda inteiro. Os números levam para a seção
 * certa já filtrada; "Atenção agora" abre o cliente direto; o funil mostra
 * onde as vendas param; e embaixo, o que vem pela frente (instalações da
 * semana e limpezas dos próximos dois meses).
 */
export function SecaoVisao() {
  const router = useRouter();
  const { itens, itensDaLoja, carregando, hoje, mostrarLoja, abrir, manutencoes } = usePosVenda();

  if (carregando) return <EsqueletoPosVenda />;

  if (itens.length === 0) {
    return (
      <EstadoVazio
        icone={HeartHandshake}
        titulo="Nenhuma venda no pós-venda ainda"
        descricao="Quando uma venda é fechada, ela aparece aqui sozinha para agendar a instalação. Clientes antigos marcados no WhatsApp também entram aqui."
      />
    );
  }

  // Na Visão geral o número não filtra aqui: leva para a seção daquele assunto.
  function irPara(f: Filtro) {
    if (f === "reclamacoes") router.push(hrefDaSecao("reclamacoes"));
    else if (f === "sem_avaliacao" || f === "avaliadas") router.push(hrefDaSecao("avaliacoes"));
    else if (f !== "todas") router.push(hrefDaSecao("instalacoes", { filtro: f }));
  }

  const emUmaSemana = somarDias(hoje, 7);
  const proximasInstalacoes = itensDaLoja
    .filter(
      (i) =>
        INSTALACAO_ABERTA.includes(i.status) &&
        i.dataAgendamento &&
        i.dataAgendamento >= hoje &&
        i.dataAgendamento <= emUmaSemana
    )
    .sort((a, b) =>
      `${a.dataAgendamento} ${a.horaAgendamento ?? ""}`.localeCompare(`${b.dataAgendamento} ${b.horaAgendamento ?? ""}`)
    );

  const emDoisMeses = somarDias(hoje, 60);
  const proximasManutencoes = manutencoes.itens
    .filter((m) => estaAberta(m) && dataDaManutencao(m) <= emDoisMeses)
    .sort((a, b) => dataDaManutencao(a).localeCompare(dataDaManutencao(b)));

  return (
    <div className="flex flex-col gap-5">
      <PosVendaKpis itens={itensDaLoja} hoje={hoje} filtro="todas" aoFiltrar={irPara} />

      {itensDaLoja.length > 0 && (
        <PosVendaAtencao itens={itensDaLoja} hoje={hoje} mostrarLoja={mostrarLoja} aoAbrir={abrir} />
      )}

      <PosVendaFunil itens={itensDaLoja} manutencoes={manutencoes.itens} hoje={hoje} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="aura-card p-4" aria-labelledby="pv-prox-inst">
          <CardHeader
            titulo={
              <span id="pv-prox-inst">
                Próximas instalações
                <span className="ml-1.5 font-normal tabular-nums text-aura-graphite-soft">{proximasInstalacoes.length}</span>
              </span>
            }
            descricao="Marcadas de hoje até daqui a 7 dias"
            icone={CalendarRange}
            acoes={<LinkVerTudo href={hrefDaSecao("instalacoes", { visao: "agenda" })}>Agenda</LinkVerTudo>}
            className="mb-1"
          />
          {proximasInstalacoes.length === 0 ? (
            <p className="py-3 text-sm text-aura-graphite-soft">Nenhuma instalação marcada para os próximos 7 dias.</p>
          ) : (
            <ul className="divide-y divide-aura-mist">
              {proximasInstalacoes.slice(0, LIMITE).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => abrir(item)}
                    className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-aura-sunken/40"
                  >
                    <Dia dia={item.dataAgendamento!} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-sm font-medium text-aura-graphite">{item.cliente}</span>
                        {item.horaAgendamento && (
                          <span className="shrink-0 text-xs tabular-nums text-aura-graphite-soft">
                            {formatarHora(item.horaAgendamento)}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-aura-graphite-soft">
                        {item.produto && <span className="max-w-[12rem] truncate">{item.produto}</span>}
                        <SeloStatus item={item} />
                        {mostrarLoja && <Selo>{item.empresa}</Selo>}
                        {item.dataAgendamento === hoje && <Selo tom="marca">Hoje</Selo>}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {proximasInstalacoes.length > LIMITE && (
            <p className="pt-2 text-xs text-aura-graphite-soft">+ {proximasInstalacoes.length - LIMITE} na agenda</p>
          )}
        </section>

        <section className="aura-card p-4" aria-labelledby="pv-prox-manut">
          <CardHeader
            titulo={
              <span id="pv-prox-manut">
                Próximas manutenções
                <span className="ml-1.5 font-normal tabular-nums text-aura-graphite-soft">{proximasManutencoes.length}</span>
              </span>
            }
            descricao={
              manutencoes.disponivel
                ? "Limpezas de chaminé e revisões até daqui a 60 dias (e as vencidas)"
                : "Previsão: instalação + 12 meses, até daqui a 60 dias (e as vencidas)"
            }
            icone={Flame}
            corIcone="text-aura-gold-700"
            acoes={<LinkVerTudo href={hrefDaSecao("manutencoes")}>Manutenções</LinkVerTudo>}
            className="mb-1"
          />
          {manutencoes.carregando ? (
            <p className="py-3 text-sm text-aura-graphite-soft">Carregando…</p>
          ) : proximasManutencoes.length === 0 ? (
            <p className="py-3 text-sm text-aura-graphite-soft">
              Nenhuma limpeza prevista para os próximos 60 dias. Elas aparecem aqui cerca de um ano depois de cada
              instalação.
            </p>
          ) : (
            <ul className="divide-y divide-aura-mist">
              {proximasManutencoes.slice(0, LIMITE).map((m) => {
                const dia = dataDaManutencao(m);
                const vencida = dia < hoje;
                const atraso = vencida ? diasEntre(dia, hoje) : null;
                return (
                  <li key={m.chave}>
                    <button
                      type="button"
                      onClick={() => abrir(m.posVenda)}
                      className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-aura-sunken/40"
                    >
                      <Dia dia={dia} vencido={vencida} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-aura-graphite">{m.posVenda.cliente}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-aura-graphite-soft">
                          <span>{ROTULO_TIPO[m.tipo]}</span>
                          <span className="tabular-nums">{formatarDia(dia)}</span>
                          {m.status === "agendada" && <Selo tom="marca">Agendada</Selo>}
                          {mostrarLoja && <Selo>{m.posVenda.empresa}</Selo>}
                          {atraso !== null && (
                            <span className="font-medium text-aura-danger">
                              vencida há {atraso} dia{atraso === 1 ? "" : "s"}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {proximasManutencoes.length > LIMITE && (
            <p className="pt-2 text-xs text-aura-graphite-soft">+ {proximasManutencoes.length - LIMITE} em Manutenções</p>
          )}
        </section>
      </div>
    </div>
  );
}
