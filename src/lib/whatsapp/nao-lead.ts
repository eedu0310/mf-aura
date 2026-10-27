/**
 * Decide se uma conversa que a IA já classificou como "não é lead" pode
 * ficar sem nova análise por enquanto.
 *
 * Função pura, separada do supervisor, porque a regra tem três portas de
 * saída e cada uma precisa de teste: o prazo, o pedido do vendedor (tratado
 * fora, em opts) e a mensagem que fala de produto.
 */

export const DIAS_SEM_REANALISAR = 7;
export const CONFIANCA_DE_NAO_LEAD = 0.3;

/**
 * Palavras que, vindas do cliente, fazem a IA olhar de novo mesmo numa
 * conversa marcada como não-lead. Cobrem todos os segmentos do grupo, não só
 * lareira.
 */
const PALAVRAS_DE_PRODUTO = [
  "lareira", "churrasqueira", "fogão", "fogao", "calefator", "calefação", "calefacao",
  "piso aquecido", "piso elétrico", "piso eletrico", "aquecimento de piso",
  "piscina", "bomba de calor", "trocador de calor",
  "aquecedor", "passagem", "boiler", "solar", "água quente", "agua quente",
  "orçamento", "orcamento", "preço", "preco", "valor", "quanto custa", "catálogo", "catalogo",
  "comprar", "instalar", "medida", "projeto",
  // Linhas que a base de conhecimento do grupo trouxe (22/10/2026).
  "pellet", "estufa", "toalheiro", "forno", "braseiro", "parrilla", "grill",
  "chaminé", "chamine", "lenha", "scheer", "titan", "guindani", "la nordica",
];

export interface LinhaDeLead {
  lead_sugerido?: boolean | null;
  confianca_lead?: number | null;
  natureza?: string | null;
  ultima_analise_em?: string | null;
}

export interface UltimaMensagem {
  fromMe?: boolean;
  text?: string | null;
}

export function falaDeProduto(texto: string | null | undefined): boolean {
  const t = (texto ?? "").toLowerCase();
  if (!t) return false;
  return PALAVRAS_DE_PRODUTO.some((p) => t.includes(p));
}

export function pareceNaoLeadRecente(
  row: LinhaDeLead,
  ultima: UltimaMensagem,
  agora = new Date(),
): boolean {
  // Já decidido pelo vendedor: o supervisor trata antes de chegar aqui.
  if (row.natureza) return false;
  // A IA sugeriu lead, ou nunca teve certeza de que NÃO é: analisa.
  if (row.lead_sugerido) return false;
  const confianca = row.confianca_lead ?? 1;
  if (confianca >= CONFIANCA_DE_NAO_LEAD) return false;
  // Prazo: uma semana sem olhar e a conversa volta à fila.
  if (!row.ultima_analise_em) return false;
  const dias = (agora.getTime() - new Date(row.ultima_analise_em).getTime()) / 86_400_000;
  if (dias >= DIAS_SEM_REANALISAR) return false;
  // O cliente falou de produto: a IA pode ter errado, deixa ela olhar.
  if (!ultima.fromMe && falaDeProduto(ultima.text)) return false;
  return true;
}

/**
 * Contato de anúncio que não deu em nada não é lead e não entra em
 * Relacionamentos (decisão do Elton, 27/10): quem clicou no anúncio e só
 * mandou a mensagem pronta do anúncio, sem responder mais nada, ou quem disse
 * que foi engano. Em Relacionamentos fica o banco de leads de verdade.
 */
export interface FalaDoChat {
  fromMe: boolean;
  text?: string | null;
  hasMedia?: boolean;
}

/** Além da mensagem do anúncio, o cliente mandou mais alguma coisa. */
export function clienteRespondeu(msgs: FalaDoChat[]): boolean {
  return msgs.filter((m) => !m.fromMe && (!!m.text?.trim() || !!m.hasMedia)).length >= 2;
}

/** A IA leu a conversa e concluiu que não é lead (engano, número errado, outro assunto). */
export function iaDescartou(row: Pick<LinhaDeLead, "lead_sugerido" | "confianca_lead">): boolean {
  return !row.lead_sugerido && row.confianca_lead != null && row.confianca_lead < CONFIANCA_DE_NAO_LEAD;
}

/**
 * O contato de anúncio vai para Relacionamentos?
 * Com a conversa na memória, decide pela resposta do cliente. Sem ela (contato
 * antigo, de antes da regra), vale o que a IA já tinha visto: se ela sugeriu
 * lead, o cliente falou de produto.
 */
export function anuncioVaiParaRelacionamentos(
  msgs: FalaDoChat[] | null,
  row: Pick<LinhaDeLead, "lead_sugerido" | "confianca_lead">,
): boolean {
  if (iaDescartou(row)) return false;
  if (msgs && msgs.length) return clienteRespondeu(msgs);
  return !!row.lead_sugerido;
}
