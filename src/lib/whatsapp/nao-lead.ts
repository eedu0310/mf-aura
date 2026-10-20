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
