/**
 * A equipe de agentes de função, na ordem em que aparece no escritório:
 * primeiro quem cuida da venda do dia (leads, follow-up, agenda, pipeline),
 * depois o cliente que já comprou (pós-venda, manutenção, reativação), o
 * marketing, a gestão (metas, orçamento, resumo), os dados, o conhecimento e,
 * por último, a Equipe Vermelha (os sabotadores do bem).
 *
 * Cada arquivo traz a regra do agente explicada no topo. Agente novo entra
 * aqui e passa a valer no motor e na tela.
 */
import type { DefinicaoAgente } from "../tipos";
import { agenteLeads } from "./leads";
import { agenteFollowup } from "./followup";
import { agenteAgenda } from "./agenda";
import { agentePipeline } from "./pipeline";
import { agentePosVenda } from "./pos-venda";
import { agenteManutencao } from "./manutencao";
import { agenteReativacao } from "./reativacao";
import { agenteMarketing } from "./marketing";
import { agenteMetas } from "./metas";
import { agenteOrcamento } from "./orcamento";
import { agenteResumoGestor } from "./resumo-gestor";
import { agenteQualidade } from "./qualidade";
import { agenteConversas } from "./conversas";
import { agenteCurador } from "./curador";
import { agenteRevisorAprendizado } from "./revisor-aprendizado";
import { agenteCacadorBrechas } from "./cacador-brechas";
import { agenteCacadorErros } from "./cacador-erros";

export const AGENTES_NATIVOS: DefinicaoAgente[] = [
  agenteLeads,
  agenteFollowup,
  agenteAgenda,
  agentePipeline,
  agentePosVenda,
  agenteManutencao,
  agenteReativacao,
  agenteMarketing,
  agenteMetas,
  agenteOrcamento,
  agenteResumoGestor,
  agenteQualidade,
  agenteConversas,
  agenteRevisorAprendizado,
  agenteCurador,
  // Equipe Vermelha: só leem e sondam; dizem o que está aberto ou quebrado e como arrumar.
  agenteCacadorBrechas,
  agenteCacadorErros,
];

export function agenteNativo(id: string): DefinicaoAgente | undefined {
  return AGENTES_NATIVOS.find((a) => a.id === id);
}
