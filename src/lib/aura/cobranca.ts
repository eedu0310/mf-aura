/**
 * Cobrança diária da supervisora.
 *
 * O Elton cobra a equipe assim: "por que não criou nenhuma oportunidade?",
 * "por que não fez nenhum fechamento no mês?", "por que não cadastrou
 * atividade?", "por que não cadastrou relacionamento?". Muita gente trabalha
 * só no WhatsApp e não registra nada no CRM; a supervisora passa a fazer a
 * mesma cobrança toda manhã, e o vendedor responde.
 *
 * Aqui só a regra, sem banco: quem está zerado em quê, a partir de que dia
 * do mês. Os primeiros dias ficam livres porque no dia 1 todo mundo está
 * zerado; fechamento só é cobrado a partir do dia 10.
 */

export type ChaveCobranca = "sem_oportunidade" | "sem_fechamento" | "sem_atividade" | "sem_relacionamento";

export interface NumerosDoMes {
  oportunidadesCriadas: number;
  fechamentos: number;
  /** Atividades lançadas pelo vendedor (sem as automáticas do WhatsApp). */
  atividades: number;
  /** Relacionamentos cadastrados pelo vendedor (sem os criados pela IA no WhatsApp). */
  relacionamentos: number;
  /** Clientes diferentes com quem ele conversou no WhatsApp pela AURA. */
  conversasWhatsapp: number;
}

export interface ItemDaCobranca {
  chave: ChaveCobranca;
  texto: string;
  pergunta: string;
}

/** A partir de que dia do mês cada item é cobrado. */
export const DIA_INICIAL: Record<ChaveCobranca, number> = {
  sem_oportunidade: 3,
  sem_atividade: 3,
  sem_relacionamento: 3,
  sem_fechamento: 10,
};

export const ROTULO_COBRANCA: Record<ChaveCobranca, string> = {
  sem_oportunidade: "Oportunidade no Pipeline",
  sem_fechamento: "Fechamento",
  sem_atividade: "Atividade registrada",
  sem_relacionamento: "Relacionamento cadastrado",
};

export function itensDaCobranca(n: NumerosDoMes, diaDoMes: number): ItemDaCobranca[] {
  const itens: ItemDaCobranca[] = [];
  const vale = (c: ChaveCobranca) => diaDoMes >= DIA_INICIAL[c];
  if (vale("sem_oportunidade") && n.oportunidadesCriadas === 0) {
    itens.push({
      chave: "sem_oportunidade",
      texto: "Nenhuma oportunidade criada no Pipeline este mês.",
      pergunta: "Por que você não criou nenhuma oportunidade?",
    });
  }
  if (vale("sem_fechamento") && n.fechamentos === 0) {
    itens.push({
      chave: "sem_fechamento",
      texto: "Nenhum fechamento lançado este mês.",
      pergunta: "Por que ainda não houve nenhum fechamento no mês?",
    });
  }
  if (vale("sem_atividade") && n.atividades === 0) {
    itens.push({
      chave: "sem_atividade",
      texto: "Nenhuma atividade registrada este mês.",
      pergunta: "Por que você não registrou nenhuma atividade?",
    });
  }
  if (vale("sem_relacionamento") && n.relacionamentos === 0) {
    itens.push({
      chave: "sem_relacionamento",
      texto: "Nenhum relacionamento cadastrado por você este mês.",
      pergunta: "Por que você não cadastrou nenhum relacionamento?",
    });
  }
  return itens;
}

export function contextoDaCobranca(n: NumerosDoMes): string | null {
  if (n.conversasWhatsapp <= 0) return null;
  return `Você conversou com ${n.conversasWhatsapp} ${n.conversasWhatsapp === 1 ? "cliente" : "clientes"} no WhatsApp este mês, mas o CRM ainda não mostra esse trabalho.`;
}

/** Origens de relacionamento criadas sozinhas (IA do WhatsApp, site): não contam como cadastro do vendedor. */
export function relacionamentoDoVendedor(origem: string | null | undefined): boolean {
  const o = String(origem ?? "").trim().toLowerCase();
  if (!o) return true;
  return !(o === "whatsapp" || o.startsWith("site mf"));
}

/** Atividades que o sistema grava sozinho não contam como registro do vendedor. */
export function atividadeDoVendedor(origem: string | null | undefined): boolean {
  const o = String(origem ?? "");
  return o !== "whatsapp_ia" && o !== "whatsapp_auto";
}
