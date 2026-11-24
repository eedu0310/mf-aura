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
    <section className="aura-card overflow-hidden" aria-label="Seu dia">
      <div className="flex items-start gap-3 border-b border-aura-mist px-4 py-3.5 sm:px-5">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aura-gold/15">
          <Sunrise size={16} className="text-aura-gold-700" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="aura-rotulo">Seu dia começa assim</p>
          <p className="mt-0.5 text-sm font-semibold text-aura-graphite sm:text-base">{briefing.resumo}</p>
        </div>
        <button
          type="button"
          onClick={fechar}
          aria-label="Fechar resumo do dia"
          className="shrink-0 rounded-lg p-1.5 text-aura-graphite-soft transition hover:bg-aura-sunken hover:text-aura-graphite"
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
                className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-aura-sunken sm:px-5"
              >
                <Icone size={15} className="shrink-0 text-aura-petrol-600" />
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
        <p className="border-t border-aura-mist px-4 py-2.5 text-xs text-aura-graphite-soft sm:px-5">
          e mais {briefing.itens.length - 8} item(ns) na agenda.
        </p>
      )}
    </section>
  );
}
