import type { Relacionamento, Oportunidade, Venda } from "@/lib/types";

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(valor);
}

export function computeQuickInsights({
  oportunidades,
  relacionamentos,
  vendas,
}: {
  oportunidades: Oportunidade[];
  relacionamentos: Relacionamento[];
  vendas: Venda[];
}): string[] {
  const insights: string[] = [];

  const paradas: Oportunidade[] = [];
  if (paradas.length > 0) {
    insights.push(
      `Você tem ${paradas.length} oportunidade${paradas.length > 1 ? "s" : ""} parada${paradas.length > 1 ? "s" : ""} há mais de 7 dias, somando ${formatarMoeda(paradas.reduce((s, o) => s + o.valor, 0))}. Vale retomar contato.`
    );
  }

  const esfriando = relacionamentos.filter(
    (r) => r.temperatura === "esfriando" || r.temperatura === "frio"
  );
  if (esfriando.length > 0) {
    insights.push(
      `${esfriando.length} relacionamento${esfriando.length > 1 ? "s estão esfriando" : " está esfriando"} — considere agendar uma visita ou ligação essa semana.`
    );
  }

  if (vendas.length > 0) {
    insights.push(
      `Você já fechou ${formatarMoeda(vendas.reduce((s, v) => s + v.valor, 0))} em vendas. Continue nesse ritmo!`
    );
  }

  if (insights.length === 0) {
    insights.push(
      "Ainda não encontrei nada urgente nos seus dados. Que tal registrar uma atividade para começar a alimentar sua rotina na AURA?"
    );
  }

  return insights;
}