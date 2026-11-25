/**
 * As rotinas que já existiam antes da equipe de agentes.
 *
 * Elas continuam rodando pelos próprios crons (deploy/aura-crons) e não
 * passam pelo motor: aqui só ganham uma mesa no escritório, para o gestor ver
 * a equipe inteira num lugar só. O estado de cada uma vem do diário dos crons
 * (aura_execucoes_cron, migração 105), pelo nome do cron.
 *
 * Não têm `executar` de propósito: o motor nunca as dispara. Ligar e desligar
 * é no crontab da VPS, não por esta tela.
 */
import type { DefinicaoAgente } from "./tipos";

export const AGENTES_DO_SISTEMA: DefinicaoAgente[] = [
  {
    id: "sistema-sentinela",
    nome: "Sentinelas",
    cargo: "Vigia da saúde do sistema",
    setor: "dados",
    icone: "ShieldCheck",
    missao: "Confere se os crons rodaram, se o backup está na nuvem, se a IA responde e se há brecha de segurança.",
    agenda: { tipo: "diario", horas: [7, 13], minuto: 30 },
    usaIA: false,
    orcamentoMensalUsd: 0,
    tipo: "sistema",
  },
  {
    id: "sistema-backup",
    nome: "Backup noturno",
    cargo: "Guarda do banco inteiro",
    setor: "dados",
    icone: "DatabaseBackup",
    missao: "Copia o banco todo, o esquema e as sessões do WhatsApp para o disco e para a nuvem, toda noite.",
    agenda: { tipo: "diario", horas: [22] },
    usaIA: false,
    orcamentoMensalUsd: 0,
    tipo: "sistema",
  },
  {
    id: "sistema-supervisao",
    nome: "Supervisão da AURA",
    cargo: "Supervisora da rotina comercial",
    setor: "gestao",
    icone: "ClipboardCheck",
    missao: "Olha a semana de cada vendedor (follow-up, negócio parado, ritmo de atividade) e deixa as recomendações do dia.",
    agenda: { tipo: "diario", horas: [9] },
    usaIA: true,
    orcamentoMensalUsd: 0,
    tipo: "sistema",
  },
  {
    id: "sistema-cobranca",
    nome: "Cobrança da supervisora",
    cargo: "Cobra quem está zerado no mês",
    setor: "gestao",
    icone: "MessageSquareWarning",
    missao: "Pergunta no Meu Dia por que a pessoa está zerada em oportunidade, fechamento, atividade ou relacionamento.",
    agenda: { tipo: "diario", horas: [9], minuto: 10, diasSemana: [1, 2, 3, 4, 5, 6] },
    usaIA: false,
    orcamentoMensalUsd: 0,
    tipo: "sistema",
  },
  {
    id: "sistema-briefing",
    nome: "Briefing do dia",
    cargo: "Abre o dia de cada vendedor",
    setor: "vendas",
    icone: "Sun",
    missao: "Monta, às 7h, o resumo do dia de cada vendedor.",
    agenda: { tipo: "diario", horas: [7] },
    usaIA: false,
    orcamentoMensalUsd: 0,
    tipo: "sistema",
  },
  {
    id: "sistema-repasse",
    nome: "Repasse de leads",
    cargo: "Não deixa lead esperando",
    setor: "vendas",
    icone: "Shuffle",
    missao: "Devolve para a fila o lead que ficou parado sem resposta.",
    agenda: { tipo: "intervalo", minutos: 5 },
    usaIA: false,
    orcamentoMensalUsd: 0,
    tipo: "sistema",
  },
  {
    id: "sistema-metas",
    nome: "Cobrança da meta",
    cargo: "Lembra quem não lançou a meta",
    setor: "gestao",
    icone: "Target",
    missao: "Do dia 1 ao 7, cobra quem ainda não definiu a meta do mês.",
    agenda: { tipo: "diario", horas: [11] },
    usaIA: false,
    orcamentoMensalUsd: 0,
    tipo: "sistema",
  },
  {
    id: "sistema-relatorios",
    nome: "Relatórios",
    cargo: "Relatório semanal e mensal",
    setor: "gestao",
    icone: "FileText",
    missao: "Escreve o relatório semanal de cada loja (sábado) e o mensal do diretor (dia 1).",
    agenda: { tipo: "diario", horas: [16], diasSemana: [6] },
    usaIA: true,
    orcamentoMensalUsd: 0,
    tipo: "sistema",
  },
  {
    id: "sistema-aprendizado",
    nome: "Aprendizado da semana",
    cargo: "Colhe lições das conversas",
    setor: "conhecimento",
    icone: "GraduationCap",
    missao: "Relê as conversas de WhatsApp da semana e sugere ao gestor o que guardar. Pula a rodada enquanto houver mais de 100 sugestões esperando revisão.",
    agenda: { tipo: "diario", horas: [21], diasSemana: [0] },
    usaIA: true,
    orcamentoMensalUsd: 0,
    tipo: "sistema",
  },
];

/** Mesa → nome do cron em aura_execucoes_cron. */
export const CRON_DO_AGENTE_DO_SISTEMA: Record<string, string> = {
  "sistema-sentinela": "sentinela",
  "sistema-backup": "backup",
  "sistema-supervisao": "supervisao-aura",
  "sistema-cobranca": "cobranca-supervisora",
  "sistema-briefing": "briefing-do-dia",
  "sistema-repasse": "repassar-leads",
  "sistema-metas": "cobrar-metas",
  "sistema-relatorios": "gerar-relatorios",
  "sistema-aprendizado": "aprendizado-do-dia",
};
