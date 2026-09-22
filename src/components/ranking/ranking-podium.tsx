import { Crown } from "lucide-react";
import type { MembroEquipe } from "@/lib/supabase/team";

const ALTURA: Record<number, string> = { 1: "h-28", 2: "h-20", 3: "h-14" };
const COR_POSICAO: Record<number, string> = {
  1: "bg-aura-gold text-aura-navy-950",
  2: "bg-aura-mist text-aura-graphite",
  3: "bg-[#c98a4f]/25 text-[#8a5a2c]",
};

function formatarMoedaCurta(valor: number) {
  if (valor >= 1000) return `R$ ${(valor / 1000).toFixed(0)}k`;
  return `R$ ${valor}`;
}

function iniciais(nome: string) {
  const partes = nome.split(" ");
  return (partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "");
}

function Coluna({ membro, posicao }: { membro: MembroEquipe; posicao: 1 | 2 | 3 }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      {posicao === 1 && <Crown size={18} className="text-aura-gold" />}
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full font-display text-sm font-semibold ${
          membro.souEu ? "bg-aura-petrol-700 text-white" : "bg-aura-petrol-700/10 text-aura-petrol-700"
        }`}
      >
        {iniciais(membro.nome)}
      </div>
      <p className="max-w-[6.5rem] truncate text-center text-xs font-medium text-aura-graphite">
        {membro.nome}
      </p>
      <p className="font-data text-xs text-aura-graphite-soft">
        {formatarMoedaCurta(membro.vendasTotal)}
      </p>
      <div
        className={`flex w-full items-start justify-center rounded-t-xl pt-1.5 ${ALTURA[posicao]} ${COR_POSICAO[posicao]}`}
      >
        <span className="font-display text-lg font-bold">{posicao}º</span>
      </div>
    </div>
  );
}

export function RankingPodium({ equipe }: { equipe: MembroEquipe[] }) {
  const top3 = [...equipe].sort((a, b) => b.vendasTotal - a.vendasTotal).slice(0, 3);
  if (top3.length < 3) return null; // pódio só faz sentido com pelo menos 3 pessoas
  const [primeiro, segundo, terceiro] = top3;

  return (
    <div className="flex items-end gap-3 rounded-2xl border border-aura-mist bg-white px-6 pb-0 pt-6">
      <Coluna membro={segundo} posicao={2} />
      <Coluna membro={primeiro} posicao={1} />
      <Coluna membro={terceiro} posicao={3} />
    </div>
  );
}
