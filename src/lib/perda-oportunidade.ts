/**
 * O que gravar junto com a etapa quando um negócio entra ou sai da perda.
 *
 * ANTES: 53 negócios estavam em "Perdidos" e NENHUM tinha motivo, descrição
 * ou data da perda. O modal do motivo existia, mas o arrasto gravava só a
 * etapa e o motivo ia para um update que descartava esses campos. O relatório
 * semanal filtra as perdas pela data — então "perdidas na semana" e "motivos
 * de perda" saíam sempre vazios, sem erro nenhum aparecer.
 *
 * A REGRA, num lugar só, para todo caminho que muda a etapa (arrasto, edição
 * do card, ferramentas da AURA):
 *
 *   entrou na perda  → data_perda = dia de hoje em São Paulo, e o motivo e a
 *                      descrição que vieram junto;
 *   saiu da perda    → motivo, descrição e data voltam a nulo (negócio
 *                      recuperado não pode continuar contando como perdido);
 *   o resto          → nada muda nesses campos.
 *
 * Quem decide se a etapa "é perda" é o PAPEL dela no funil (ehPerda), nunca o
 * nome — o gestor pode renomear "Perdidos" à vontade.
 */
import { ehPerda, type EtapaFunil } from "@/lib/funil";
import { diaEmSaoPaulo } from "@/lib/fuso";

export interface DadosDaPerda {
  motivo?: string | null;
  descricao?: string | null;
}

/** Os mesmos três campos, nos nomes da tela (Oportunidade) e do banco. */
export interface CamposDaPerda {
  tela: { motivoPerda?: string | null; descricaoPerda?: string | null; dataPerda?: string | null };
  banco: { motivo_perda?: string | null; descricao_perda?: string | null; data_perda?: string | null };
}

export function camposDaPerdaAoMudarEtapa(
  etapaAnterior: string | null | undefined,
  etapaNova: string | null | undefined,
  funil: EtapaFunil[],
  perda: DadosDaPerda = {},
  agora: Date = new Date(),
): CamposDaPerda {
  const estavaPerdido = ehPerda(etapaAnterior, funil);
  const ficaPerdido = ehPerda(etapaNova, funil);

  if (ficaPerdido && !estavaPerdido) {
    // Data do dia de São Paulo: às 22h de Brasília o UTC já é amanhã, e a
    // perda de domingo à noite caía na semana seguinte do relatório.
    const data = diaEmSaoPaulo(agora);
    const tela: CamposDaPerda["tela"] = { dataPerda: data };
    const banco: CamposDaPerda["banco"] = { data_perda: data };
    // Só grava motivo/descrição quando vieram: não apaga um motivo que já
    // estava no card só porque este caminho não perguntou de novo.
    if (perda.motivo) {
      tela.motivoPerda = perda.motivo;
      banco.motivo_perda = perda.motivo;
    }
    if (perda.descricao) {
      tela.descricaoPerda = perda.descricao;
      banco.descricao_perda = perda.descricao;
    }
    return { tela, banco };
  }

  if (estavaPerdido && !ficaPerdido) {
    return {
      tela: { motivoPerda: null, descricaoPerda: null, dataPerda: null },
      banco: { motivo_perda: null, descricao_perda: null, data_perda: null },
    };
  }

  return { tela: {}, banco: {} };
}

/** Está entrando na perda agora (e por isso precisa de um motivo)? */
export function entraNaPerda(
  etapaAnterior: string | null | undefined,
  etapaNova: string | null | undefined,
  funil: EtapaFunil[],
): boolean {
  return ehPerda(etapaNova, funil) && !ehPerda(etapaAnterior, funil);
}
