import type { Venda } from "@/lib/types";

export interface PontoEvolucao {
  dia: string;
  valor: number;
}

/**
 * Calcula a evolução acumulada de vendas reais dentro do mês atual,
 * a partir das vendas de verdade (não inventa uma "meta").
 */
export function computeSalesEvolution(vendas: Venda[]): PontoEvolucao[] {
  const agora = new Date();
  const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
  const doMes = vendas
    .filter((v) => v.data.startsWith(mesAtual))
    .slice()
    .sort((a, b) => a.data.localeCompare(b.data));

  if (doMes.length === 0) return [];

  const porDia = new Map<string, number>();
  for (const v of doMes) {
    porDia.set(v.data, (porDia.get(v.data) ?? 0) + v.valor);
  }

  const diasOrdenados = [...porDia.keys()].sort();
  let acumulado = 0;
  return diasOrdenados.map((data) => {
    acumulado += porDia.get(data) ?? 0;
    const [, mes, dia] = data.split("-");
    return { dia: `${dia}/${mes}`, valor: acumulado };
  });
}
