/**
 * Regras puras do Agente de Manutenção (sem banco, para os testes).
 *
 * A limpeza da chaminé é anual. O agente começa a avisar no 11º mês — 30
 * dias antes da data — porque é o tempo de ligar, combinar o dia e encaixar
 * na agenda do técnico. Passou da data sem ser feita, vira "vencida".
 *
 * Sazonalidade (Rio Grande do Sul): o frio chega em maio/junho e todo mundo
 * lembra da lareira ao mesmo tempo. Quem limpa entre fevereiro e maio pega a
 * agenda vazia e o cliente usa a lareira segura no primeiro frio. Nesses
 * meses a prioridade sobe.
 */
import type { Prioridade } from "../tipos";
import { somarDias } from "@/components/pos-venda/regras";

export const DIAS_DE_AVISO = 30;
/** Fevereiro a maio: a janela antes do inverno. */
export const MESES_PRE_INVERNO = [2, 3, 4, 5];

export interface ManutencaoParaRegra {
  status: "prevista" | "agendada" | "realizada" | "cancelada";
  dataPrevista: string;
  dataAgendada: string | null;
}

export type SituacaoManutencao = "vencida" | "proxima";

/** Vencida, próxima (dentro de 30 dias) ou nada a fazer agora (nulo). */
export function situacaoManutencao(m: ManutencaoParaRegra, hoje: string): SituacaoManutencao | null {
  if (m.status !== "prevista" && m.status !== "agendada") return null;
  const dia = (m.dataAgendada ?? m.dataPrevista).slice(0, 10);
  if (dia < hoje) return "vencida";
  // Já combinada com o cliente e ainda no futuro: nada a cobrar.
  if (m.status === "agendada") return null;
  if (dia <= somarDias(hoje, DIAS_DE_AVISO)) return "proxima";
  return null;
}

export function prioridadeManutencao(s: SituacaoManutencao, hoje: string): Prioridade {
  const preInverno = MESES_PRE_INVERNO.includes(Number(hoje.slice(5, 7)));
  if (s === "vencida") return preInverno ? "alta" : "media";
  return preInverno ? "media" : "baixa";
}
