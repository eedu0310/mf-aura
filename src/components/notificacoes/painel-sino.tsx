"use client";

import Link from "next/link";
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
      <p className="border-b border-aura-mist px-4 py-3 text-sm font-medium text-aura-graphite">Notificações</p>
      {vazio ? (
        <p className="px-4 py-6 text-center text-xs text-aura-graphite-soft">Nada pendente agora.</p>
      ) : (
        <ul className="max-h-80 overflow-y-auto">
          {lembretes.map((n) => (
            <li key={`l-${n.id}`} className="border-b border-aura-mist last:border-b-0">
              <Link
                href={n.href ?? `/relacionamentos?buscar=${encodeURIComponent(n.titulo.split("· ")[1] ?? "")}`}
                onClick={aoFechar}
                className="block px-4 py-3 hover:bg-aura-bg"
              >
                <p className="text-sm font-medium text-aura-graphite">{n.titulo}</p>
                <p className={`mt-1 text-xs font-medium ${n.urgente ? "text-aura-danger" : "text-aura-graphite-soft"}`}>{n.quando}</p>
              </Link>
            </li>
          ))}
          {avisos.map((a) => {
            const novo = novos.has(a.id);
            return (
              <li key={a.id} className="border-b border-aura-mist last:border-b-0">
                <Link
                  href={a.acaoUrl || "/meu-dia"}
                  onClick={aoFechar}
                  className={`flex gap-2.5 px-4 py-3 hover:bg-aura-bg ${novo ? "bg-aura-petrol-700/5" : ""}`}
                >
                  <span
                    aria-hidden
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${novo ? "bg-aura-danger" : "bg-transparent"}`}
                  />
                  <span className="min-w-0">
                    <span className={`block text-sm ${novo ? "font-semibold text-aura-graphite" : "font-medium text-aura-graphite-soft"}`}>
                      {a.titulo}
                    </span>
                    <span className="mt-1 block text-xs text-aura-graphite-soft">{a.mensagem}</span>
                    <span className="mt-1 block text-[0.7rem] text-aura-graphite-soft/80">{quandoFoi(a.criadaEm)}</span>
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
