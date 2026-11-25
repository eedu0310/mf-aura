"use client";

import { AlertTriangle, Clock, Star } from "lucide-react";
import type { PosVenda } from "@/lib/supabase/pos-venda";
import { Selo } from "@/components/ui";
import { INFO_STATUS, estaAtrasada, temReclamacaoAberta } from "./regras";

/** Selo com o nome da etapa, na cor da coluna do quadro. */
export function SeloStatus({ item }: { item: PosVenda }) {
  const info = INFO_STATUS[item.status];
  return <Selo tom={info?.tom ?? "neutro"}>{info?.titulo ?? item.status}</Selo>;
}

/**
 * Os sinais que pedem olho: atraso, reclamação aberta e a nota do cliente.
 * Mesmos selos no quadro, na lista e na agenda.
 */
export function Sinais({ item, hoje, semNota = false }: { item: PosVenda; hoje: string; semNota?: boolean }) {
  const atrasada = estaAtrasada(item, hoje);
  const reclamacao = temReclamacaoAberta(item);
  const nota = item.avaliouLoja && item.notaAvaliacao ? item.notaAvaliacao : null;
  if (!atrasada && !reclamacao && (semNota || !nota)) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {atrasada && (
        <Selo tom="perigo">
          <Clock size={10} aria-hidden />
          Atrasada
        </Selo>
      )}
      {reclamacao && (
        <Selo tom="perigo">
          <AlertTriangle size={10} aria-hidden />
          Reclamação
        </Selo>
      )}
      {!semNota && nota && <Nota valor={nota} />}
    </span>
  );
}

export function Nota({ valor }: { valor: number }) {
  return (
    <Selo tom="ouro" className="tabular-nums">
      <Star size={10} className="fill-aura-gold text-aura-gold" aria-hidden />
      {valor}
      <span className="sr-only"> de 5 estrelas</span>
    </Selo>
  );
}

/** Bloco cinza pulsando, para o carregamento. */
export function Osso({ className = "" }: { className?: string }) {
  return <span className={`block animate-pulse rounded-md bg-aura-sunken ${className}`} aria-hidden />;
}

/** Esqueleto da tela inteira enquanto a lista chega do banco. */
export function EsqueletoPosVenda() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando pós-venda">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aura-card flex flex-col gap-3 p-4">
            <Osso className="h-3 w-20" />
            <Osso className="h-6 w-12" />
          </div>
        ))}
      </div>
      <div className="aura-card flex flex-col gap-3 p-4">
        <Osso className="h-4 w-40" />
        <Osso className="h-9 w-full" />
        <Osso className="h-9 w-full" />
      </div>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex w-[16.5rem] shrink-0 flex-col gap-2 rounded-xl border border-aura-mist bg-aura-sunken/50 p-2.5 xl:w-auto xl:flex-1">
            <Osso className="h-4 w-28" />
            {Array.from({ length: 3 - (i % 2) }).map((__, j) => (
              <div key={j} className="flex flex-col gap-2 rounded-lg border border-aura-mist bg-aura-surface p-3">
                <Osso className="h-3.5 w-3/4" />
                <Osso className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
