"use client";

import Link from "next/link";
import { BellOff } from "lucide-react";
import type { Sino } from "@/lib/use-sino";

function quandoFoi(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const min = Math.round((Date.now() - t) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

/**
 * A lista do sininho, a mesma no computador e no celular. O que chegou desde
 * a última abertura aparece destacado; o que já foi visto continua na lista,
 * em cinza, para quem quiser reler.
 */
export function PainelDoSino({ sino, aoFechar, className }: { sino: Sino; aoFechar: () => void; className: string }) {
  const { avisos, lembretes, novos } = sino;
  const vazio = avisos.length === 0 && lembretes.length === 0;

  return (
    <div className={className}>
      <div className="flex items-center justify-between border-b border-aura-mist px-4 py-3">
        <p className="text-sm font-semibold text-aura-graphite">Notificações</p>
        {novos.size > 0 && <span className="aura-selo aura-selo-marca tabular-nums">{novos.size}</span>}
      </div>
      {vazio ? (
        <div className="flex flex-col items-center px-4 py-8 text-center">
          <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-aura-sunken">
            <BellOff size={16} className="text-aura-graphite-soft" />
          </span>
          <p className="text-xs text-aura-graphite-soft">Nada pendente agora.</p>
        </div>
      ) : (
        <ul className="max-h-96 divide-y divide-aura-mist overflow-y-auto">
          {lembretes.map((n) => (
            <li key={`l-${n.id}`}>
              <Link
                href={n.href ?? `/relacionamentos?buscar=${encodeURIComponent(n.titulo.split("· ")[1] ?? "")}`}
                onClick={aoFechar}
                className="block px-4 py-3 transition hover:bg-aura-sunken"
              >
                <p className="text-sm font-medium text-aura-graphite">{n.titulo}</p>
                <p className={`mt-0.5 text-xs font-medium ${n.urgente ? "text-aura-danger" : "text-aura-graphite-soft"}`}>{n.quando}</p>
              </Link>
            </li>
          ))}
          {avisos.map((a) => {
            const novo = novos.has(a.id);
            return (
              <li key={a.id}>
                <Link
                  href={a.acaoUrl || "/meu-dia"}
                  onClick={aoFechar}
                  className={`flex gap-2.5 px-4 py-3 transition hover:bg-aura-sunken ${novo ? "bg-aura-petrol-500/[0.06]" : ""}`}
                >
                  <span
                    aria-hidden
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${novo ? "bg-aura-petrol-500" : "bg-transparent"}`}
                  />
                  <span className="min-w-0">
                    <span className={`block text-sm ${novo ? "font-semibold text-aura-graphite" : "font-medium text-aura-graphite-soft"}`}>
                      {a.titulo}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-aura-graphite-soft">{a.mensagem}</span>
                    <span className="mt-1 block text-[0.7rem] tabular-nums text-aura-graphite-soft/80">{quandoFoi(a.criadaEm)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
