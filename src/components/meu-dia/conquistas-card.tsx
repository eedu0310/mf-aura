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
        <div className="rounded-lg bg-aura-bg p-3 text-center">
          <p className="text-2xl font-bold text-aura-graphite">
            {desbloqueadas}/{conquistas.length}
          </p>
          <p className="text-xs text-aura-graphite-soft">Desbloqueadas</p>
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
                className={`rounded-lg p-2 text-center text-xs ${
                  c.desbloqueada
                    ? "bg-aura-success/10 border border-aura-success/20"
                    : "bg-aura-mist border border-aura-mist"
                }`}
              >
                <p className="font-medium text-aura-graphite">{c.titulo}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PanelCard>
  );
}