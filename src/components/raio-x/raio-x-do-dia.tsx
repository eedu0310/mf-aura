"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  FileText,
  Inbox,
  PhoneCall,
  Snowflake,
  Timer,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { ChevronDown, User } from "lucide-react";
import type {
  BlocoDoRaioX,
  RaioX,
  RaioXDeUmVendedor,
  TipoDeBloco,
} from "@/lib/raio-x/montar";

/**
 * O raio-x do dia, em blocos.
 *
 * Substitui o parágrafo corrido que a IA escrevia. O vendedor abre e vê, em
 * blocos separados e na ordem de urgência, o que precisa fazer — sem ler um
 * texto inteiro para achar um nome no meio da frase.
 *
 * Cada item leva para a tela onde ele se resolve. Os urgentes são marcados,
 * não só coloridos: quem enxerga mal ou imprime em preto e branco continua
 * sabendo qual é qual.
 */

/** "1 lead sem resposta" / "3 leads sem resposta". */
function contarBloco(b: BlocoDoRaioX): string {
  return `${b.total} ${b.total === 1 ? b.nomes[0] : b.nomes[1]}`;
}

const ICONE: Record<TipoDeBloco, typeof CalendarClock> = {
  agenda: CalendarClock,
  followup: PhoneCall,
  orcamento: FileText,
  parado: Timer,
  esfriando: Snowflake,
  posvenda: Wrench,
  lead: Inbox,
};

export function RaioXDoDia({
  raioX,
  nome,
  saudacao,
}: {
  raioX: RaioX;
  nome: string;
  saudacao: string;
}) {
  const primeiroNome = (nome || "").split(" ")[0];

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="font-display text-base font-semibold text-aura-graphite">
          {saudacao}, {primeiroNome}. Seu raio-x do dia.
        </p>
        <p className="mt-0.5 text-sm text-aura-graphite-soft">
          {raioX.totalDeItens === 0
            ? "Nada esperando por você. Bom momento para prospectar."
            : `${raioX.totalDeItens} ${raioX.totalDeItens === 1 ? "coisa pede" : "coisas pedem"} a sua atenção, na ordem.`}
        </p>
      </div>

      {raioX.blocos.map((bloco) => (
        <Bloco key={bloco.tipo} bloco={bloco} />
      ))}
    </div>
  );
}

function Bloco({ bloco }: { bloco: BlocoDoRaioX }) {
  const Icone = ICONE[bloco.tipo];
  const urgentes = bloco.itens.filter((i) => i.urgente).length;

  return (
    <section className="rounded-xl border border-aura-mist bg-white">
      <header className="flex items-baseline gap-2 border-b border-aura-mist px-3.5 py-2.5">
        <Icone size={15} className="relative top-0.5 shrink-0 text-aura-petrol-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-aura-graphite">
            {bloco.titulo}
            <span className="ml-1.5 font-normal text-aura-graphite-soft">({bloco.total})</span>
          </p>
          {bloco.legenda && (
            <p className="mt-0.5 text-xs leading-snug text-aura-graphite-soft">{bloco.legenda}</p>
          )}
        </div>
        {urgentes > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-aura-gold/15 px-2 py-0.5 text-xs font-medium text-aura-gold-700">
            <AlertTriangle size={11} />
            {urgentes}
          </span>
        )}
      </header>

      <ul className="divide-y divide-aura-mist/70">
        {bloco.itens.map((item, i) => {
          const miolo = (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-aura-graphite">
                  {item.urgente && (
                    <AlertTriangle
                      size={12}
                      className="mr-1 inline-block align-[-1px] text-aura-gold-700"
                      aria-label="atenção"
                    />
                  )}
                  {item.titulo}
                </span>
                {item.detalhe && (
                  <span className="block truncate text-xs text-aura-graphite-soft">
                    {item.detalhe}
                  </span>
                )}
              </span>
              {item.hora && (
                <span className="shrink-0 rounded-md bg-aura-mist/60 px-1.5 py-0.5 text-xs font-medium tabular-nums text-aura-graphite">
                  {item.hora}
                </span>
              )}
              {item.link && (
                <ChevronRight size={14} className="shrink-0 text-aura-graphite-soft" />
              )}
            </>
          );

          return (
            <li key={`${item.titulo}-${i}`}>
              {item.link ? (
                <Link
                  href={item.link}
                  className="flex items-center gap-2 px-3.5 py-2 transition hover:bg-aura-bg/60"
                >
                  {miolo}
                </Link>
              ) : (
                <span className="flex items-center gap-2 px-3.5 py-2">{miolo}</span>
              )}
            </li>
          );
        })}
      </ul>

      {bloco.total > bloco.itens.length && (
        <p className="border-t border-aura-mist px-3.5 py-2 text-xs text-aura-graphite-soft">
          e mais {bloco.total - bloco.itens.length} — veja a lista completa na tela.
        </p>
      )}
    </section>
  );
}


/**
 * O raio-x da equipe, um vendedor por vez — a visão do gestor.
 *
 * Fechado por padrão, mostrando só o nome e o placar. O gestor abre quem ele
 * quer cobrar. Aberto tudo de uma vez, com dez vendedores, seria uma parede
 * de cem linhas em que não se acha nada — exatamente a queixa que trouxe esta
 * tela a existir.
 *
 * O primeiro já vem aberto porque é o mais carregado, e porque uma tela toda
 * fechada não mostra do que ela é feita.
 */
export function RaioXDaEquipe({
  vendedores,
  saudacao,
  nome,
}: {
  vendedores: RaioXDeUmVendedor[];
  saudacao: string;
  nome: string;
}) {
  const primeiroNome = (nome || "").split(" ")[0];
  const [aberto, setAberto] = useState<string | null>(vendedores[0]?.id ?? null);
  const total = vendedores.reduce((s, v) => s + v.raioX.totalDeItens, 0);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="font-display text-base font-semibold text-aura-graphite">
          {saudacao}, {primeiroNome}. A equipe hoje.
        </p>
        <p className="mt-0.5 text-sm text-aura-graphite-soft">
          {vendedores.length === 0
            ? "Ninguém com pendência hoje. Dia limpo na loja."
            : `${total} ${total === 1 ? "pendência" : "pendências"} em ${vendedores.length} ${
                vendedores.length === 1 ? "pessoa" : "pessoas"
              }. Toque num nome para ver.`}
        </p>
      </div>

      {vendedores.map((v) => {
        const estaAberto = aberto === v.id;
        const urgentes = v.raioX.blocos.reduce(
          (s, b) => s + b.itens.filter((i) => i.urgente).length,
          0,
        );

        return (
          <section key={v.id} className="rounded-xl border border-aura-mist bg-white">
            <button
              type="button"
              onClick={() => setAberto(estaAberto ? null : v.id)}
              aria-expanded={estaAberto}
              className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left transition hover:bg-aura-bg/50"
            >
              <User size={15} className="shrink-0 text-aura-petrol-600" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-aura-graphite">
                  {v.nome}
                </span>
                <span className="block text-xs text-aura-graphite-soft">
                  {v.raioX.blocos.map(contarBloco).join(" · ")}
                </span>
              </span>
              {urgentes > 0 && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-aura-gold/15 px-2 py-0.5 text-xs font-medium text-aura-gold-700">
                  <AlertTriangle size={11} />
                  {urgentes}
                </span>
              )}
              <ChevronDown
                size={15}
                className={`shrink-0 text-aura-graphite-soft transition-transform ${
                  estaAberto ? "rotate-180" : ""
                }`}
              />
            </button>

            {estaAberto && (
              <div className="flex flex-col gap-2.5 border-t border-aura-mist bg-aura-bg/30 p-3">
                {v.raioX.blocos.map((bloco) => (
                  <Bloco key={bloco.tipo} bloco={bloco} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
