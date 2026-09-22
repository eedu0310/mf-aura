import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { MembroEquipe } from "@/lib/supabase/team";

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(valor);
}

function iniciais(nome: string) {
  const partes = nome.split(" ");
  return (partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "");
}

function tendenciaDe(m: MembroEquipe) {
  if (m.vendasEsteMes > m.vendasMesPassado) return "subiu";
  if (m.vendasEsteMes < m.vendasMesPassado) return "caiu";
  return "estavel";
}

const ICONE_TENDENCIA = {
  subiu: <TrendingUp size={14} className="text-aura-success" />,
  caiu: <TrendingDown size={14} className="text-aura-danger" />,
  estavel: <Minus size={14} className="text-aura-graphite-soft" />,
};

export function RankingList({ equipe }: { equipe: MembroEquipe[] }) {
  const ordenado = [...equipe].sort((a, b) => b.vendasTotal - a.vendasTotal);

  return (
    <div className="rounded-2xl border border-aura-mist bg-white">
      <ul className="flex flex-col divide-y divide-aura-mist">
        {ordenado.map((m, i) => (
          <li
            key={m.id}
            className={`flex items-center gap-3 px-5 py-3.5 ${m.souEu ? "bg-aura-petrol-700/[0.04]" : ""}`}
          >
            <span className="w-5 shrink-0 text-center font-data text-sm text-aura-graphite-soft">
              {i + 1}º
            </span>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aura-petrol-700/10 font-display text-xs font-semibold text-aura-petrol-700">
              {iniciais(m.nome)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-aura-graphite">
                {m.nome}
                {m.souEu && <span className="ml-1.5 text-xs text-aura-petrol-600">(você)</span>}
              </p>
              <p className="text-xs text-aura-graphite-soft">
                {m.atividades7dias} atividade{m.atividades7dias !== 1 ? "s" : ""} nos últimos 7 dias
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {ICONE_TENDENCIA[tendenciaDe(m)]}
              <span className="font-data text-sm font-medium text-aura-graphite">
                {formatarMoeda(m.vendasTotal)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
