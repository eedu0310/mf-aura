/**
 * Histórico do atendimento da IA dentro do lead.
 *
 * Pedido do Elton (25/11): quando o agente do Instagram ou o assistente do
 * chat do site atende o cliente, o vendedor que assume precisa ver o que foi
 * conversado — um resumo e a conversa. Sem coluna nova: a conversa vai no fim
 * do recado do lead (mensagem_inicial), depois de uma marca, e o resumo em
 * resumo_ia. A tela de leads separa as duas partes e mostra a conversa
 * recolhida.
 */

export const MARCA_CONVERSA_IA = "--- Conversa com o assistente de IA ---";
const LIMITE_RECADO = 6000;

export type FalaDoHistorico = { quem: "Cliente" | "Assistente" | "Loja"; texto: string };

/** Linhas "Cliente: …" / "Assistente: …", uma por fala. */
export function transcricao(falas: FalaDoHistorico[]): string {
  return falas
    .filter((f) => f.texto.trim())
    .map((f) => `${f.quem}: ${f.texto.replace(/\s*\n\s*/g, " ").trim()}`)
    .join("\n");
}

/** Cabeçalho do lead + marca + conversa, cortando o começo da conversa se passar do limite. */
export function juntarHistorico(cabecalho: string, conversa: string): string {
  const topo = `${cabecalho.trim()}\n\n${MARCA_CONVERSA_IA}\n`;
  const sobra = LIMITE_RECADO - topo.length;
  let corpo = conversa.trim();
  if (corpo.length > sobra) {
    corpo = corpo.slice(corpo.length - sobra);
    corpo = `(…)\n${corpo.slice(corpo.indexOf("\n") + 1)}`;
  }
  return `${topo}${corpo}`;
}

/** Separa o recado do lead em cabeçalho e falas da conversa com a IA. */
export function separarHistorico(texto: string | null | undefined): { cabecalho: string; falas: FalaDoHistorico[] } {
  const t = texto ?? "";
  const i = t.indexOf(MARCA_CONVERSA_IA);
  if (i < 0) return { cabecalho: t.trim(), falas: [] };
  const falas: FalaDoHistorico[] = [];
  for (const linha of t.slice(i + MARCA_CONVERSA_IA.length).split("\n")) {
    const m = /^(Cliente|Assistente|Loja):\s?(.*)$/.exec(linha.trim());
    if (m) falas.push({ quem: m[1] as FalaDoHistorico["quem"], texto: m[2] });
    else if (linha.trim() && falas.length) falas[falas.length - 1].texto += ` ${linha.trim()}`;
  }
  return { cabecalho: t.slice(0, i).trim(), falas };
}
