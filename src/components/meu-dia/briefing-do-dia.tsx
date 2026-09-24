"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, ChevronRight, Phone, Star, Sunrise, X } from "lucide-react";

interface Item {
  tipo: "compromisso" | "followup" | "whatsapp" | "avaliacao";
  titulo: string;
  detalhe?: string;
  hora?: string;
  link: string;
}

interface Briefing {
  dia: string;
  nome: string;
  resumo: string;
  itens: Item[];
}

const ICONE = {
  compromisso: CalendarClock,
  followup: Phone,
  whatsapp: Phone,
  avaliacao: Star,
};

const CHAVE = "aura:briefingVistoEm";

/**
 * O primeiro acesso do dia abre com o que está pendente.
 *
 * Aparece uma vez por dia por aparelho. O cron das 7h cobre quem não abre o
 * sistema de manhã, então ninguém fica sem o aviso.
 */
export function BriefingDoDia() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [fechado, setFechado] = useState(true);

  useEffect(() => {
    let vivo = true;

    (async () => {
      try {
        const res = await fetch("/api/briefing", { cache: "no-store" });
        if (!res.ok) return;
        const json: Briefing = await res.json();
        if (!vivo || !json.itens?.length) return;

        let visto: string | null = null;
        try {
          visto = window.localStorage.getItem(CHAVE);
        } catch {
          // navegador sem armazenamento: mostra mesmo assim, é melhor que nada
        }

        setBriefing(json);
        setFechado(visto === json.dia);
      } catch {
        // sem briefing hoje, segue a tela normal
      }
    })();

    return () => {
      vivo = false;
    };
  }, []);

  function fechar() {
    setFechado(true);
    try {
      if (briefing) window.localStorage.setItem(CHAVE, briefing.dia);
    } catch {
      // sem armazenamento, reaparece no próximo acesso — aceitável
    }
  }

  if (!briefing || fechado) return null;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-aura-mist bg-white shadow-sm"
      aria-label="Seu dia"
    >
      <div className="flex items-start gap-3 bg-aura-navy-950 px-4 py-3 sm:px-5">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aura-gold/15 ring-1 ring-aura-gold/40">
          <Sunrise className="h-5 w-5 text-aura-gold" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-aura-gold/80">
            Seu dia começa assim
          </p>
          <p className="text-base font-semibold text-white sm:text-lg">{briefing.resumo}</p>
        </div>
        <button
          type="button"
          onClick={fechar}
          aria-label="Fechar resumo do dia"
          className="shrink-0 rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      <ul className="divide-y divide-aura-mist">
        {briefing.itens.slice(0, 8).map((item, i) => {
          const Icone = ICONE[item.tipo] ?? CalendarClock;
          return (
            <li key={`${item.titulo}-${i}`}>
              <Link
                href={item.link}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-aura-bg sm:px-5"
              >
                <Icone size={16} className="shrink-0 text-aura-petrol-600" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-aura-graphite">
                    {item.titulo}
                  </span>
                  {(item.hora || item.detalhe) && (
                    <span
                      className={`text-xs ${
                        item.detalhe === "atrasado" ? "text-aura-danger" : "text-aura-graphite-soft"
                      }`}
                    >
                      {[item.hora, item.detalhe].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
                <ChevronRight size={15} className="shrink-0 text-aura-graphite-soft" />
              </Link>
            </li>
          );
        })}
      </ul>

      {briefing.itens.length > 8 && (
        <p className="px-4 py-2.5 text-xs text-aura-graphite-soft sm:px-5">
          e mais {briefing.itens.length - 8} item(ns) na agenda.
        </p>
      )}
    </section>
  );
}
