import type { Atividade, Oportunidade, Relacionamento } from "@/lib/types";

export type PrioridadeNivel = "urgente" | "alta" | "media" | "baixa";

export interface PrioridadeComercial {
  id: string;
  nivel: PrioridadeNivel;
  titulo: string;
  descricao: string;
  entidadeTipo: "relacionamento" | "oportunidade" | "atividade";
  entidadeId: string;
  acaoLabel: string;
  acaoHref: string;
  valor?: number;
  prazo?: string;
}

export interface ProximaMelhorAcao {
  label: string;
  descricao: string;
  href: string;
  nivel: PrioridadeNivel;
}

function diasDesde(data?: string) {
  if (!data) return 999;
  const tempo = new Date(data).getTime();
  if (!Number.isFinite(tempo)) return 999;
  return Math.max(0, Math.floor((Date.now() - tempo) / 86_400_000));
}

function prioridadePorDias(dias: number): PrioridadeNivel {
  if (dias >= 14) return "urgente";
  if (dias >= 7) return "alta";
  if (dias >= 3) return "media";
  return "baixa";
}

export function calcularProximaMelhorAcao(oportunidade: Oportunidade): ProximaMelhorAcao {
  const hrefRelacionamento = oportunidade.relacionamentoId
    ? `/relacionamentos?buscar=${encodeURIComponent(oportunidade.cliente)}`
    : "/registrar-atividade";
  const diasParado = oportunidade.diasParado ?? 0;

  if (oportunidade.etapa === "Fechados") {
    return {
      label: "Iniciar pós-venda",
      descricao: "Confirmar a jornada de instalação e o próximo contato com o cliente.",
      href: "/pos-venda",
      nivel: "media",
    };
  }
  if (oportunidade.etapa === "Perdidos") {
    return {
      label: "Revisar oportunidade",
      descricao: "Avaliar se existe motivo para recuperar este negócio.",
      href: "/pipeline",
      nivel: "baixa",
    };
  }
  if (oportunidade.etapa === "Proposta" || oportunidade.etapa === "Negociação") {
    return {
      label: diasParado >= 3 ? "Fazer follow-up hoje" : "Agendar próximo contato",
      descricao: diasParado >= 3
        ? `Esta oportunidade está parada há ${diasParado} dias.`
        : "Mantenha um próximo passo registrado para não perder o ritmo.",
      href: hrefRelacionamento,
      nivel: prioridadePorDias(diasParado),
    };
  }
  return {
    label: "Qualificar oportunidade",
    descricao: "Registrar necessidade, prazo e próximo passo antes de avançar no funil.",
    href: hrefRelacionamento,
    nivel: diasParado >= 7 ? "alta" : "media",
  };
}

export function calcularPrioridadesComerciais({
  relacionamentos,
  oportunidades,
  atividades,
}: {
  relacionamentos: Relacionamento[];
  oportunidades: Oportunidade[];
  atividades: Atividade[];
}): PrioridadeComercial[] {
  const prioridades: PrioridadeComercial[] = [];
  const hoje = new Date();

  for (const oportunidade of oportunidades) {
    if (oportunidade.etapa === "Fechados" || oportunidade.etapa === "Perdidos") continue;
    const acao = calcularProximaMelhorAcao(oportunidade);
    const diasParado = oportunidade.diasParado ?? 0;
    if (diasParado < 3 && oportunidade.etapa !== "Proposta" && oportunidade.etapa !== "Negociação") continue;
    prioridades.push({
      id: `oportunidade-${oportunidade.id}`,
      nivel: acao.nivel,
      titulo: `${acao.label}: ${oportunidade.cliente}`,
      descricao: `${acao.descricao} Valor: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(oportunidade.valor)}.`,
      entidadeTipo: "oportunidade",
      entidadeId: oportunidade.id,
      acaoLabel: acao.label,
      acaoHref: acao.href,
      valor: oportunidade.valor,
    });
  }

  for (const relacionamento of relacionamentos) {
    const data = relacionamento.proximoContatoEm || relacionamento.ultimoContatoEm;
    const dias = diasDesde(data);
    const contatoVencido = relacionamento.proximoContatoEm
      ? new Date(relacionamento.proximoContatoEm).getTime() < hoje.getTime()
      : false;
    const semContato = !relacionamento.ultimoContatoEm || dias >= 30;
    if (!contatoVencido && !semContato && relacionamento.temperatura !== "frio" && relacionamento.temperatura !== "esfriando") continue;
    prioridades.push({
      id: `relacionamento-${relacionamento.id}`,
      nivel: contatoVencido || semContato ? "urgente" : "alta",
      titulo: `Retomar contato: ${relacionamento.nome}`,
      descricao: contatoVencido
        ? "O próximo contato está vencido. Registre o retorno realizado ou reagende uma data."
        : "O relacionamento precisa de uma próxima ação registrada.",
      entidadeTipo: "relacionamento",
      entidadeId: relacionamento.id,
      acaoLabel: "Registrar contato",
      acaoHref: `/relacionamentos?buscar=${encodeURIComponent(relacionamento.nome)}`,
      prazo: relacionamento.proximoContatoEm,
    });
  }

  const hojeTexto = hoje.toISOString().slice(0, 10);
  for (const atividade of atividades) {
    if (!atividade.proximoContatoEm || atividade.proximoContatoEm.slice(0, 10) > hojeTexto) continue;
    prioridades.push({
      id: `atividade-${atividade.id}`,
      nivel: atividade.proximoContatoEm.slice(0, 10) < hojeTexto ? "urgente" : "alta",
      titulo: `Retorno pendente: ${atividade.clienteNome || atividade.contexto}`,
      descricao: "Existe um próximo contato previsto para hoje ou para uma data vencida.",
      entidadeTipo: "atividade",
      entidadeId: atividade.id,
      acaoLabel: "Abrir agenda",
      acaoHref: "/agenda",
      prazo: atividade.proximoContatoEm,
    });
  }

  const ordem: Record<PrioridadeNivel, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };
  return prioridades.sort((a, b) => (ordem[a.nivel] - ordem[b.nivel]) || ((b.valor ?? 0) - (a.valor ?? 0))).slice(0, 12);
}

export function rotuloPrioridade(nivel: PrioridadeNivel) {
  return { urgente: "Agora", alta: "Hoje", media: "Esta semana", baixa: "Acompanhar" }[nivel];
}
