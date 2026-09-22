import type { Relacionamento, Oportunidade } from "@/lib/types";

export interface MissaoDoDia {
  titulo: string;
  progresso: number;
  meta: number;
  concluida: boolean;
}

export function computeMissoesDoDia({
  relacionamentos,
  oportunidades,
  atividades,
}: {
  relacionamentos: Relacionamento[];
  oportunidades: Oportunidade[];
  atividades: any[];
}): MissaoDoDia[] {
  const hojeCurto = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date());

  const atividadesHoje = atividades.filter(
    (a) => a.quando.startsWith(hojeCurto) || a.quando === "Agora mesmo"
  ).length;
  const pendentes = relacionamentos.filter(
    (r) =>
      r.proximoContato.toLowerCase().includes("atrasado") || r.proximoContato.toLowerCase().includes("hoje")
  ).length;
  const paradas = 0;

  return [
    {
      titulo: "Registrar atividades hoje",
      progresso: Math.min(atividadesHoje, 3),
      meta: 3,
      concluida: atividadesHoje >= 3,
    },
    {
      titulo: "Zerar follow-ups pendentes",
      progresso: pendentes === 0 ? 1 : 0,
      meta: 1,
      concluida: pendentes === 0,
    },
    {
      titulo: "Manter pipeline em dia",
      progresso: paradas === 0 ? 1 : 0,
      meta: 1,
      concluida: paradas === 0,
    },
  ];
}