"use client";

import { Trophy } from "lucide-react";
import { PanelCard } from "@/components/panel-card";

interface Conquista {
  titulo: string;
  descricao: string;
  desbloqueada?: boolean;
}

interface NivelPerformance {
  id: string;
  nome: string;
}

interface ConquistasCardProps {
  conquistas: Conquista[];
  niveis: NivelPerformance[];
  vendasTotal: number;
}

export function ConquistasCard({
  conquistas,
  niveis,
  vendasTotal,
}: ConquistasCardProps) {
  const desbloqueadas = conquistas.filter((c) => c.desbloqueada).length;

  return (
    <PanelCard icon={Trophy} titulo="Conquistas e Prêmios">
      <div className="space-y-4">
        {/* Resumo */}
        <div className="flex items-baseline justify-between rounded-lg bg-aura-sunken px-3 py-2.5">
          <p className="aura-rotulo">Desbloqueadas</p>
          <p className="font-display text-xl font-semibold tabular-nums text-aura-graphite">
            {desbloqueadas}/{conquistas.length}
          </p>
        </div>

        {/* Conquistas */}
        {conquistas.length === 0 ? (
          <p className="py-2 text-center text-xs text-aura-graphite-soft">
            Nenhuma conquista ainda
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {conquistas.slice(0, 4).map((c, idx) => (
              <li
                key={idx}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs ${
                  c.desbloqueada
                    ? "border-aura-success/25 bg-aura-success/[0.06]"
                    : "border-aura-mist bg-aura-sunken"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.desbloqueada ? "bg-aura-success" : "bg-aura-graphite-soft/40"}`}
                />
                <p className={`font-medium ${c.desbloqueada ? "text-aura-graphite" : "text-aura-graphite-soft"}`}>{c.titulo}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PanelCard>
  );
}