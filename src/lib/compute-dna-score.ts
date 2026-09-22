import type { Atividade, Relacionamento, Oportunidade } from "@/lib/types";

export interface DnaScoreDetalhe {
  label: string;
  percentual: number;
  explicacao: string;
}

export interface DnaScoreResultado {
  score: number;
  mensagem: string;
  detalhes: DnaScoreDetalhe[];
  recomendacao: string;
}

function limitar(valor: number) {
  return Math.max(0, Math.min(100, Math.round(valor)));
}

function diasDesde(data?: string) {
  if (!data) return 999;
  const tempo = new Date(data).getTime();
  if (!Number.isFinite(tempo)) return 999;
  return Math.max(0, Math.floor((Date.now() - tempo) / 86_400_000));
}

/**
 * Calcula o DNA comercial a partir de fatos observáveis no CRM.
 * A IA pode interpretar o resultado, mas não altera esta pontuação.
 */
export function computeDnaScore({
  relacionamentos,
  oportunidades,
  atividades,
}: {
  relacionamentos: Relacionamento[];
  oportunidades: Oportunidade[];
  atividades: Atividade[];
}): DnaScoreResultado {
  const atividadesRecentes = atividades.filter((atividade) => diasDesde(atividade.ocorridaEm || atividade.criadoEm) <= 30);
  const followupsEmDia = relacionamentos.filter((relacionamento) => {
    if (!relacionamento.proximoContatoEm) return false;
    return new Date(relacionamento.proximoContatoEm).getTime() >= Date.now();
  }).length;
  const followupsComData = relacionamentos.filter((relacionamento) => relacionamento.proximoContatoEm).length;
  const oportunidadesAbertas = oportunidades.filter((oportunidade) => oportunidade.etapa !== "Fechados" && oportunidade.etapa !== "Perdidos");
  const oportunidadesSaudaveis = oportunidadesAbertas.filter((oportunidade) => (oportunidade.diasParado ?? 0) < 7).length;
  const vendasRelacionadas = oportunidades.filter((oportunidade) => oportunidade.etapa === "Fechados").length;
  const relacionamentosAtivos = relacionamentos.filter((relacionamento) => relacionamento.temperatura === "quente" || relacionamento.temperatura === "ativo").length;
  const registrosComProximoPasso = atividades.filter((atividade) => Boolean(atividade.proximoPasso?.trim())).length;

  const prospeccao = limitar((atividadesRecentes.filter((atividade) => atividade.tipo === "Prospecção").length / 5) * 100);
  const relacionamento = limitar(relacionamentos.length ? (relacionamentosAtivos / relacionamentos.length) * 100 : 100);
  const followup = limitar(followupsComData ? (followupsEmDia / followupsComData) * 100 : 100);
  const execucao = limitar((atividadesRecentes.length / 10) * 100);
  const conversao = limitar(oportunidades.length ? (vendasRelacionadas / oportunidades.length) * 100 : 100);
  const organizacao = limitar(atividades.length ? (registrosComProximoPasso / atividades.length) * 100 : 100);
  const desenvolvimento = limitar(oportunidadesAbertas.length ? (oportunidadesSaudaveis / oportunidadesAbertas.length) * 100 : 100);

  const detalhes: DnaScoreDetalhe[] = [
    { label: "Prospecção", percentual: prospeccao, explicacao: `${atividadesRecentes.filter((atividade) => atividade.tipo === "Prospecção").length} prospecções nos últimos 30 dias.` },
    { label: "Relacionamento", percentual: relacionamento, explicacao: `${relacionamentosAtivos} de ${relacionamentos.length} relacionamentos em temperatura ativa ou quente.` },
    { label: "Follow-up", percentual: followup, explicacao: `${followupsEmDia} de ${followupsComData} próximos contatos com data futura.` },
    { label: "Execução", percentual: execucao, explicacao: `${atividadesRecentes.length} atividades registradas nos últimos 30 dias.` },
    { label: "Conversão", percentual: conversao, explicacao: `${vendasRelacionadas} oportunidades fechadas em ${oportunidades.length} oportunidades.` },
    { label: "Organização", percentual: organizacao, explicacao: `${registrosComProximoPasso} atividades com próximo passo definido.` },
    { label: "Desenvolvimento", percentual: desenvolvimento, explicacao: `${oportunidadesSaudaveis} oportunidades abertas sem mais de 7 dias paradas.` },
  ];

  const score = limitar(detalhes.reduce((total, detalhe) => total + detalhe.percentual, 0) / detalhes.length);
  const menorPilar = [...detalhes].sort((a, b) => a.percentual - b.percentual)[0];
  const mensagem = score >= 85 ? "Excelente consistência comercial." : score >= 60 ? "Bom ritmo. Há espaço para evoluir com foco." : "A AURA identificou pontos importantes para recuperar seu ritmo.";

  return {
    score,
    mensagem,
    detalhes,
    recomendacao: menorPilar ? `Seu maior potencial de evolução está em ${menorPilar.label}: ${menorPilar.explicacao}` : "Continue registrando seus próximos passos.",
  };
}
