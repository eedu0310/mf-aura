/**
 * Regras puras do Revisor do Aprendizado (sem banco e sem IA, para os testes).
 *
 * A IA dá um PARECER; quem decide o que vai para o banco é este arquivo. As
 * travas que o prompt pede também valem aqui, em código, porque um modelo
 * que "esqueceu" uma regra não pode aprovar preço inventado:
 *
 *   - evidência contra (perdeu mais do que fechou, com 3 casos ou mais) →
 *     fica para o gestor, diga a IA o que disser;
 *   - confiança abaixo de 0,75 → fica para o gestor;
 *   - repete um aprendizado já aprovado da loja → recusa;
 *   - telefone, e-mail ou documento no texto → recusa (dado pessoal não vai
 *     para o prompt de ninguém);
 *   - aprovar texto com preço, desconto, prazo, garantia, pagamento ou
 *     número técnico que NÃO aparece nos materiais da loja → não aprova:
 *     fica para o gestor. (Recusar isso só quando a própria IA recusou: os
 *     trechos que mandamos são uma amostra do manual, e o que não veio nela
 *     pode estar certo. Na dúvida, decide gente.)
 */
import { normalizar, palavras } from "@/lib/conhecimento/recuperar";

export type Decisao = "aprovar" | "recusar" | "manter";

export const CONFIANCA_MINIMA = 0.75;
export const CASOS_PARA_CONTRADICAO = 3;
export const SEMELHANCA_DUPLICADO = 0.8;
export const TAMANHO_DO_LOTE = 10;

export interface ItemRevisao {
  id: string;
  empresa: string;
  tipo: string;
  gatilho: string;
  resposta: string;
  vezes_visto: number;
  vezes_fechou: number;
  vezes_perdeu: number | null;
}

export interface Parecer {
  id: string;
  decisao: Decisao;
  motivo: string;
  confianca: number;
  resposta_ajustada?: string;
}

export interface DecisaoFinal {
  decisao: Decisao;
  motivo: string;
  confianca: number;
  /** Só quando aprova com o texto corrigido pela IA. */
  novaResposta?: string;
  /** true = decidido por regra (sem precisar da IA). */
  porRegra: boolean;
}

/** Divide a lista em lotes de `tamanho`. */
export function emLotes<T>(itens: T[], tamanho = TAMANHO_DO_LOTE): T[][] {
  const n = Math.max(1, Math.floor(tamanho));
  const saida: T[][] = [];
  for (let i = 0; i < itens.length; i += n) saida.push(itens.slice(i, i + n));
  return saida;
}

/** Perdeu mais do que fechou, com casos suficientes para isso dizer algo. */
export function evidenciaContra(a: Pick<ItemRevisao, "vezes_fechou" | "vezes_perdeu">): boolean {
  const perdeu = a.vezes_perdeu ?? 0;
  return perdeu > a.vezes_fechou && perdeu + a.vezes_fechou >= CASOS_PARA_CONTRADICAO;
}

export function temDadoPessoal(texto: string): boolean {
  return (
    /[\w.+-]+@[\w-]+(\.[\w-]+)+/.test(texto) ||
    /\(?\+?\d[\d\s().-]{8,}\d/.test(texto) ||
    /\d{3}\.\d{3}\.\d{3}-\d{2}/.test(texto)
  );
}

/** Semelhança (Jaccard) entre as palavras de dois textos. */
export function semelhanca(a: string, b: string): number {
  const pa = new Set(palavras(a));
  const pb = new Set(palavras(b));
  if (!pa.size || !pb.size) return 0;
  let comum = 0;
  for (const p of pa) if (pb.has(p)) comum++;
  return comum / (pa.size + pb.size - comum);
}

/** O aprovado da loja que este item repete (id), ou nulo. */
export function duplicadoDe(
  item: Pick<ItemRevisao, "id" | "empresa" | "gatilho">,
  aprovados: Array<{ id: string; empresa: string; gatilho: string }>,
): string | null {
  const alvo = normalizar(item.gatilho);
  for (const a of aprovados) {
    if (a.empresa !== item.empresa || a.id === item.id) continue;
    if (normalizar(a.gatilho) === alvo || semelhanca(a.gatilho, item.gatilho) >= SEMELHANCA_DUPLICADO) return a.id;
  }
  return null;
}

const FAMILIAS_SENSIVEIS: Array<[string, RegExp]> = [
  ["preço", /pre[cç]o|r\$|\breais\b|\bcusta|\bvalor(es)?\b/i],
  ["desconto", /desconto|promo[cç][aã]o|abatimento/i],
  ["prazo", /prazo|dias [uú]teis|entrega em/i],
  ["garantia", /garantia|vital[ií]ci/i],
  ["pagamento", /parcel|juros|pix|boleto|cart[aã]o|[aà] vista|entrada de/i],
];

/**
 * O que o texto afirma de sensível e os materiais não confirmam: números que
 * não aparecem nos trechos e assuntos (garantia, prazo…) que os trechos nem
 * citam. Lista vazia = nada inventado à vista.
 */
export function afirmacoesSemApoio(texto: string, materiais: string): string[] {
  const mat = normalizar(materiais);
  const numerosMat = new Set((materiais.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(/\./g, "").replace(",", ".")));
  const falta: string[] = [];
  for (const n of texto.match(/\d+(?:[.,]\d+)?/g) ?? []) {
    const limpo = n.replace(/\./g, "").replace(",", ".");
    if (!numerosMat.has(limpo)) falta.push(n);
  }
  for (const [nome, re] of FAMILIAS_SENSIVEIS) {
    if (re.test(texto) && !re.test(materiais) && !mat.includes(normalizar(nome))) falta.push(nome);
  }
  return [...new Set(falta)];
}

/**
 * Decisões que não precisam da IA. Nulo = mande para a IA.
 */
export function decisaoPorRegra(
  item: ItemRevisao,
  aprovados: Array<{ id: string; empresa: string; gatilho: string }>,
): DecisaoFinal | null {
  if (temDadoPessoal(`${item.gatilho} ${item.resposta}`)) {
    return { decisao: "recusar", motivo: "Tem dado pessoal de cliente (telefone, e-mail ou documento).", confianca: 1, porRegra: true };
  }
  if (evidenciaContra(item)) {
    return {
      decisao: "manter",
      motivo: `Perdeu ${item.vezes_perdeu}x e fechou ${item.vezes_fechou}x: o resultado contradiz a resposta, decida você.`,
      confianca: 1,
      porRegra: true,
    };
  }
  const dup = duplicadoDe(item, aprovados);
  if (dup) return { decisao: "recusar", motivo: "Repete um aprendizado que já está aprovado na loja.", confianca: 1, porRegra: true };
  return null;
}

/**
 * Lê a resposta da IA sem confiar nela: aceita { decisoes: [...] }, { itens:
 * [...] } ou a lista direta; descarta o que não for de um id do lote, com
 * decisão fora das três, sem motivo ou com confiança fora de 0–1.
 */
export function validarPareceres(bruto: unknown, idsDoLote: string[]): Map<string, Parecer> {
  const ids = new Set(idsDoLote);
  const lista: unknown[] = Array.isArray(bruto)
    ? bruto
    : bruto && typeof bruto === "object"
      ? ((bruto as Record<string, unknown>).decisoes ?? (bruto as Record<string, unknown>).itens ?? []) as unknown[]
      : [];
  const saida = new Map<string, Parecer>();
  if (!Array.isArray(lista)) return saida;
  for (const x of lista) {
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    const id = String(r.id ?? "");
    const decisao = String(r.decisao ?? "");
    const motivo = typeof r.motivo === "string" ? r.motivo.trim() : "";
    const confianca = typeof r.confianca === "number" ? r.confianca : Number(r.confianca);
    if (!ids.has(id) || saida.has(id)) continue;
    if (decisao !== "aprovar" && decisao !== "recusar" && decisao !== "manter") continue;
    if (!motivo || !Number.isFinite(confianca) || confianca < 0 || confianca > 1) continue;
    const ajustada = typeof r.resposta_ajustada === "string" ? r.resposta_ajustada.trim() : "";
    saida.set(id, {
      id,
      decisao,
      // Uma frase: corta no primeiro ponto final, e no máximo 240 caracteres.
      motivo: (motivo.match(/^[^.!?]*[.!?]/)?.[0] ?? motivo).slice(0, 240),
      confianca,
      resposta_ajustada: ajustada.length >= 8 ? ajustada.slice(0, 2000) : undefined,
    });
  }
  return saida;
}

/**
 * Junta o parecer da IA com as travas. `materiais` são os trechos da loja
 * que foram mostrados à IA para este item.
 */
export function decisaoFinal(item: ItemRevisao, parecer: Parecer | undefined, materiais: string): DecisaoFinal {
  if (!parecer) return { decisao: "manter", motivo: "Sem parecer válido da IA nesta rodada.", confianca: 0, porRegra: true };
  if (evidenciaContra(item)) {
    return { decisao: "manter", motivo: "O resultado nas vendas contradiz a resposta: decida você.", confianca: parecer.confianca, porRegra: true };
  }
  if (parecer.confianca < CONFIANCA_MINIMA || parecer.decisao === "manter") {
    return { decisao: "manter", motivo: parecer.motivo, confianca: parecer.confianca, porRegra: false };
  }
  if (parecer.decisao === "recusar") {
    return { decisao: "recusar", motivo: parecer.motivo, confianca: parecer.confianca, porRegra: false };
  }
  const texto = parecer.resposta_ajustada ?? item.resposta;
  if (temDadoPessoal(texto)) {
    return { decisao: "recusar", motivo: "A resposta tem dado pessoal de cliente.", confianca: 1, porRegra: true };
  }
  // Só a resposta: é ela que a AURA vai repetir. A pergunta do cliente pode falar de prazo à vontade.
  const semApoio = afirmacoesSemApoio(texto, materiais);
  if (semApoio.length) {
    return {
      decisao: "manter",
      motivo: `Fala de ${semApoio.slice(0, 3).join(", ")} sem apoio nos materiais da loja: confira antes de aprovar.`,
      confianca: parecer.confianca,
      porRegra: true,
    };
  }
  return {
    decisao: "aprovar",
    motivo: parecer.motivo,
    confianca: parecer.confianca,
    novaResposta: parecer.resposta_ajustada && parecer.resposta_ajustada !== item.resposta ? parecer.resposta_ajustada : undefined,
    porRegra: false,
  };
}
