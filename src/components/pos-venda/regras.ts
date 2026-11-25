/**
 * Regras da tela de pós-venda, num lugar só.
 *
 * Tudo aqui é calculado a partir dos campos que já vêm do banco
 * (src/lib/supabase/pos-venda.ts). Nada de campo novo: se um número não dá
 * para tirar desses campos, ele não aparece na tela.
 */
import type { PosVenda, StatusPosVenda } from "@/lib/supabase/pos-venda";
import type { Tom } from "@/components/ui";
import { diaEmSaoPaulo } from "@/lib/fuso";

/**
 * As colunas do quadro, no vocabulário que o banco aceita.
 *
 * Três destas colunas já tiveram nome que a tabela pos_vendas recusa no CHECK
 * ("instalacao_agendada", "instalacao_realizada", "concluido"): arrastar um
 * card para elas dava erro no banco, e o alerta de instalação atrasada nunca
 * disparava. Ver a explicação inteira em src/lib/supabase/pos-venda.ts.
 */
export const COLUNAS: {
  status: StatusPosVenda;
  titulo: string;
  dica: string;
  cor: string;
  tom: Tom;
}[] = [
  {
    status: "aguardando_instalacao",
    titulo: "Aguardando instalação",
    dica: "Venda fechada, falta agendar",
    cor: "bg-aura-graphite-soft",
    tom: "neutro",
  },
  {
    status: "agendamento_realizado",
    titulo: "Instalação agendada",
    dica: "Data marcada com o cliente",
    cor: "bg-aura-petrol-500",
    tom: "marca",
  },
  {
    status: "instalacao_pendente",
    titulo: "Instalação pendente",
    dica: "A data passou, precisa reagendar",
    cor: "bg-aura-warning",
    tom: "atencao",
  },
  {
    status: "reclamacao",
    titulo: "Reclamação",
    dica: "Cliente reclamou, resolver",
    cor: "bg-aura-danger",
    tom: "perigo",
  },
  {
    status: "pos_venda_realizado",
    titulo: "Pós-venda concluído",
    dica: "Instalado e acompanhado",
    cor: "bg-aura-success",
    tom: "sucesso",
  },
  // Quem comprou antes do CRM e o vendedor marcou como cliente antigo no
  // WhatsApp. Daqui ele vai para Reclamação ou Concluído como qualquer outro.
  {
    status: "cliente_antigo",
    titulo: "Clientes antigos",
    dica: "Marcados no WhatsApp, sem venda no CRM",
    cor: "bg-aura-gold",
    tom: "ouro",
  },
];

export const INFO_STATUS = Object.fromEntries(COLUNAS.map((c) => [c.status, c])) as Record<
  StatusPosVenda,
  (typeof COLUNAS)[number]
>;

/** Ordem do status no quadro — usada para ordenar a lista por status. */
export const ORDEM_STATUS = Object.fromEntries(COLUNAS.map((c, i) => [c.status, i])) as Record<StatusPosVenda, number>;

/** Etapas em que ainda há trabalho a fazer com o cliente. */
const EM_ANDAMENTO: StatusPosVenda[] = ["aguardando_instalacao", "agendamento_realizado", "instalacao_pendente", "reclamacao"];

/** Etapas em que a instalação ainda não aconteceu (as que entram na agenda). */
export const INSTALACAO_ABERTA: StatusPosVenda[] = ["aguardando_instalacao", "agendamento_realizado", "instalacao_pendente"];

/**
 * "Hoje" no fuso de Brasília. O toISOString() é UTC: depois das 21h no
 * Brasil já era amanhã, e a instalação marcada para hoje aparecia atrasada.
 * É a mesma conta do "Meu Dia" (listarMinhasPendenciasPosVenda).
 */
export function hojeISO() {
  return diaEmSaoPaulo();
}

/** Dias entre duas datas "AAAA-MM-DD" (b − a). Nulo se faltar alguma. */
export function diasEntre(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return null;
  const ta = Date.parse(`${a.slice(0, 10)}T00:00:00Z`);
  const tb = Date.parse(`${b.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null;
  return Math.round((tb - ta) / 86_400_000);
}

/** Soma dias a uma data "AAAA-MM-DD". */
export function somarDias(dia: string, dias: number) {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function estaAtrasada(item: PosVenda, hoje: string) {
  if (!item.dataAgendamento) return false;
  if (item.status !== "agendamento_realizado") return false;
  return item.dataAgendamento < hoje;
}

export function temReclamacaoAberta(item: PosVenda) {
  return Boolean(item.reclamacao?.trim()) && !item.reclamacaoResolvida;
}

export function estaEmAndamento(item: PosVenda) {
  return EM_ANDAMENTO.includes(item.status);
}

/** Cliente antigo não é venda: fica fora das métricas de venda. */
export function ehVenda(item: PosVenda) {
  return item.origem !== "cliente_antigo";
}

/** Venda fechada há mais que isto sem data de instalação vira pendência. */
export const DIAS_SEM_AGENDAR = 7;

/* ----------------------------------------------------------- filtros */

export type Filtro = "todas" | "em_andamento" | "atrasadas" | "reclamacoes" | "sem_avaliacao" | "avaliadas";

export const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "em_andamento", rotulo: "Em andamento" },
  { valor: "atrasadas", rotulo: "Atrasadas" },
  { valor: "reclamacoes", rotulo: "Reclamações" },
  { valor: "sem_avaliacao", rotulo: "Sem avaliação" },
  { valor: "avaliadas", rotulo: "Avaliadas" },
];

export function passaNoFiltro(item: PosVenda, filtro: Filtro, hoje: string) {
  switch (filtro) {
    case "em_andamento":
      return estaEmAndamento(item);
    case "atrasadas":
      return estaAtrasada(item, hoje);
    case "reclamacoes":
      return temReclamacaoAberta(item);
    case "sem_avaliacao":
      return !item.avaliouLoja;
    case "avaliadas":
      return item.avaliouLoja;
    default:
      return true;
  }
}

/* ------------------------------------------------------ o que pede ação */

export type Motivo = {
  chave: "atrasada" | "reclamacao" | "pendente" | "sem_agendar" | "sem_avaliacao";
  tom: "perigo" | "atencao" | "marca";
  texto: string;
  acao: string;
};

/**
 * O motivo mais urgente para alguém mexer neste pós-venda agora, ou nulo.
 * A ordem é a prioridade: atraso e reclamação primeiro, avaliação por último.
 */
export function motivoDeAtencao(item: PosVenda, hoje: string): Motivo | null {
  if (estaAtrasada(item, hoje)) {
    const dias = diasEntre(item.dataAgendamento, hoje) ?? 0;
    return {
      chave: "atrasada",
      tom: "perigo",
      texto: `Instalação atrasada há ${dias} dia${dias === 1 ? "" : "s"}`,
      acao: "Reagendar",
    };
  }
  if (temReclamacaoAberta(item)) {
    return { chave: "reclamacao", tom: "perigo", texto: "Reclamação em aberto", acao: "Resolver" };
  }
  if (item.status === "instalacao_pendente") {
    return { chave: "pendente", tom: "atencao", texto: "Instalação pendente, reagendar", acao: "Reagendar" };
  }
  if (item.status === "aguardando_instalacao" && !item.dataAgendamento && ehVenda(item)) {
    const dias = diasEntre(item.dataVenda, hoje);
    if (dias !== null && dias > DIAS_SEM_AGENDAR) {
      return { chave: "sem_agendar", tom: "atencao", texto: `Sem agendamento há ${dias} dias`, acao: "Agendar" };
    }
  }
  if (item.status === "pos_venda_realizado" && !item.avaliouLoja && ehVenda(item)) {
    return { chave: "sem_avaliacao", tom: "marca", texto: "Concluída sem avaliação", acao: "Pedir avaliação" };
  }
  return null;
}

/* ------------------------------------------------------------ formatos */

export function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(valor);
}

/** "2026-11-25" → "25/11/2026" (ou "25/11" com `curta`). */
export function formatarDia(dia: string | null | undefined, curta = false) {
  if (!dia) return "—";
  const [ano, mes, d] = dia.slice(0, 10).split("-");
  return curta ? `${d}/${mes}` : `${d}/${mes}/${ano}`;
}

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Dia da semana abreviado de uma data "AAAA-MM-DD". */
export function diaDaSemana(dia: string) {
  return SEMANA[new Date(`${dia.slice(0, 10)}T12:00:00Z`).getUTCDay()];
}

/** "hoje", "há 1 dia", "há 12 dias". */
export function haQuantoTempo(dias: number | null) {
  if (dias === null) return "";
  if (dias <= 0) return "hoje";
  return `há ${dias} dia${dias === 1 ? "" : "s"}`;
}

/** Hora "14:30:00" → "14:30". */
export function formatarHora(hora: string | null | undefined) {
  return hora ? hora.slice(0, 5) : "";
}
