import type { Atividade, Oportunidade, Relacionamento, Venda } from "@/lib/types";
import { contaNoPipeline, ehFechada, ehGanho, FUNIL_PADRAO, type EtapaFunil } from "@/lib/funil";

export interface MetricasPeriodo {
  inicio: string;
  fim: string;
  atividades: number;
  prospeccoes: number;
  followUps: number;
  novosRelacionamentos: number;
  propostas: number;
  fechamentos: number;
  valorVendido: number;
  retornosVencidos: number;
  oportunidadesParadas: number;
}

export interface FatorComparativo {
  nome: string;
  atual: number;
  anterior: number;
  variacaoPercentual: number | null;
  leitura: "queda" | "alta" | "estavel";
  explicacao: string;
}

export interface AnalisePorQueNaoVendo {
  atual: MetricasPeriodo;
  anterior: MetricasPeriodo;
  fatores: FatorComparativo[];
  principal: FatorComparativo | null;
  secundarios: FatorComparativo[];
  mensagem: string;
}

function dataValida(valor?: string) {
  if (!valor) return false;
  const tempo = new Date(valor).getTime();
  return Number.isFinite(tempo);
}

function isoData(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function noIntervalo(valor: string | undefined, inicio: Date, fim: Date) {
  if (!dataValida(valor)) return false;
  const tempo = new Date(valor as string).getTime();
  return tempo >= inicio.getTime() && tempo < fim.getTime();
}

function variacao(atual: number, anterior: number) {
  if (anterior === 0) return atual === 0 ? 0 : null;
  return Math.round(((atual - anterior) / Math.abs(anterior)) * 100);
}

function comparar(nome: string, atual: number, anterior: number, formato: (v: number) => string): FatorComparativo {
  const variacaoPercentual = variacao(atual, anterior);
  const leitura = atual < anterior ? "queda" : atual > anterior ? "alta" : "estavel";
  const diferenca = atual - anterior;
  const verbo = leitura === "queda" ? "caiu" : leitura === "alta" ? "subiu" : "ficou estável";
  const detalhe = leitura === "estavel"
    ? `${nome} ficou estável em ${formato(atual)}.`
    : `${nome} ${verbo} de ${formato(anterior)} para ${formato(atual)} (${diferenca > 0 ? "+" : ""}${formato(diferenca)}).`;
  return { nome, atual, anterior, variacaoPercentual, leitura, explicacao: detalhe };
}

function coletarMetricas(
  inicio: Date,
  fim: Date,
  atividades: Atividade[],
  oportunidades: Oportunidade[],
  vendas: Venda[],
  relacionamentos: Relacionamento[],
  funil: EtapaFunil[],
): MetricasPeriodo {
  const atividadesPeriodo = atividades.filter((a) => noIntervalo(a.ocorridaEm || a.quando || a.criadoEm, inicio, fim));
  const vendasPeriodo = vendas.filter((v) => noIntervalo(v.data || v.criadoEm, inicio, fim));
  const oportunidadesPeriodo = oportunidades.filter((o) => noIntervalo(o.criadoEm || o.atualizado, inicio, fim));
  const relacionamentosPeriodo = relacionamentos.filter((r) => noIntervalo(r.criadoEm || r.atualizado, inicio, fim));
  const fimHoje = new Date();

  return {
    inicio: isoData(inicio),
    fim: isoData(new Date(fim.getTime() - 1)),
    atividades: atividadesPeriodo.length,
    prospeccoes: atividadesPeriodo.filter((a) => a.tipo === "Prospecção").length,
    followUps: atividadesPeriodo.filter((a) => a.tipo === "Follow-up").length,
    novosRelacionamentos: relacionamentosPeriodo.length,
    propostas: oportunidadesPeriodo.filter((o) => contaNoPipeline(o.etapa, funil) || ehGanho(o.etapa, funil)).length,
    fechamentos: vendasPeriodo.length,
    valorVendido: vendasPeriodo.reduce((soma, venda) => soma + (venda.valorFechado ?? venda.valor), 0),
    retornosVencidos: relacionamentos.filter((r) => {
      if (!r.proximoContatoEm || !dataValida(r.proximoContatoEm)) return false;
      const data = new Date(r.proximoContatoEm);
      return data < fimHoje && data >= inicio;
    }).length,
    oportunidadesParadas: oportunidades.filter((o) => (o.diasParado ?? 0) >= 7 && !ehFechada(o.etapa, funil)).length,
  };
}

export function analisarPorQueNaoVendo({
  atividades,
  oportunidades,
  vendas,
  relacionamentos,
  dias = 30,
  funil = FUNIL_PADRAO,
}: {
  atividades: Atividade[];
  oportunidades: Oportunidade[];
  vendas: Venda[];
  relacionamentos: Relacionamento[];
  dias?: number;
  funil?: EtapaFunil[];
}): AnalisePorQueNaoVendo {
  const fimAtual = new Date();
  const inicioAtual = new Date(fimAtual);
  inicioAtual.setDate(inicioAtual.getDate() - dias);
  const fimAnterior = new Date(inicioAtual);
  const inicioAnterior = new Date(inicioAtual);
  inicioAnterior.setDate(inicioAnterior.getDate() - dias);

  const atual = coletarMetricas(inicioAtual, fimAtual, atividades, oportunidades, vendas, relacionamentos, funil);
  const anterior = coletarMetricas(inicioAnterior, fimAnterior, atividades, oportunidades, vendas, relacionamentos, funil);
  const moeda = (valor: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(valor);
  const inteiro = (valor: number) => String(valor);

  const fatores = [
    comparar("Atividades registradas", atual.atividades, anterior.atividades, inteiro),
    comparar("Prospecções", atual.prospeccoes, anterior.prospeccoes, inteiro),
    comparar("Follow-ups", atual.followUps, anterior.followUps, inteiro),
    comparar("Novos relacionamentos", atual.novosRelacionamentos, anterior.novosRelacionamentos, inteiro),
    comparar("Propostas e negociações", atual.propostas, anterior.propostas, inteiro),
    comparar("Fechamentos", atual.fechamentos, anterior.fechamentos, inteiro),
    comparar("Valor vendido", atual.valorVendido, anterior.valorVendido, moeda),
    comparar("Retornos vencidos", atual.retornosVencidos, anterior.retornosVencidos, inteiro),
    comparar("Oportunidades paradas", atual.oportunidadesParadas, anterior.oportunidadesParadas, inteiro),
  ];

  const pesos: Record<string, number> = {
    "Prospecções": 5,
    "Follow-ups": 5,
    "Propostas e negociações": 4,
    "Retornos vencidos": 4,
    "Oportunidades paradas": 4,
    "Atividades registradas": 3,
    "Novos relacionamentos": 3,
    "Fechamentos": 2,
    "Valor vendido": 2,
  };
  const problemas = fatores
    .filter((fator) => fator.leitura === "queda" || (fator.nome.includes("vencidos") || fator.nome.includes("paradas")) && fator.atual > fator.anterior)
    .sort((a, b) => {
      const impactoA = Math.abs(a.variacaoPercentual ?? 100) * (pesos[a.nome] ?? 1);
      const impactoB = Math.abs(b.variacaoPercentual ?? 100) * (pesos[b.nome] ?? 1);
      return impactoB - impactoA;
    });
  const principal = problemas[0] ?? null;
  const secundarios = problemas.slice(1, 3);

  return {
    atual,
    anterior,
    fatores,
    principal,
    secundarios,
    mensagem: principal
      ? `O principal sinal observado é ${principal.nome.toLowerCase()}. Isso é uma indicação baseada na comparação dos últimos ${dias} dias com os ${dias} dias anteriores, não uma conclusão sobre intenção do cliente.`
      : "Não há queda clara nos indicadores comparados. Continue registrando cada contato para a AURA acompanhar a tendência.",
  };
}
