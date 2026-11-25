/**
 * Recuperação de conhecimento para os prompts.
 *
 * O PROBLEMA: a base de conhecimento cresce sem parar (é o objetivo), e o
 * prompt não pode crescer junto. Antes, textoDoAprendizado pegava os 120 com
 * mais fechamentos e cortava em 8 mil caracteres: o 121º nunca entrava, por
 * melhor que fosse para AQUELA conversa, e o corte por caracteres partia o
 * último item no meio.
 *
 * A SOLUÇÃO: dado o assunto (a consulta) e um orçamento de tokens, devolver
 * o conhecimento APROVADO mais relevante — aprendizados e trechos dos
 * manuais — até encher o orçamento, item inteiro ou nada. Sem consulta, vale
 * o que mais fechou venda e o mais recente.
 *
 * A pontuação é simples de propósito (palavras em comum, sem acento e sem
 * palavra vazia; recência; vezes que fechou venda): roda em milissegundos,
 * não custa IA e dá para explicar a qualquer gestor por que um item entrou.
 *
 * As funções de ranking são puras e testadas em recuperar.teste.ts.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { todasAsLinhas } from "@/lib/supabase/todas-as-linhas";

export interface ItemConhecimento {
  tipo: "aprendizado" | "trecho";
  id: string;
  /** O texto que vai para o prompt, já formatado. */
  texto: string;
  /** Onde a busca procura (pode ser diferente do texto exibido). */
  busca: string;
  criadoEm?: string | null;
  vezesFechou?: number;
  vezesVisto?: number;
  vezesPerdeu?: number;
  /** Nota que o banco deu ao trecho (aura_buscar_trechos), quando houver. */
  notaBanco?: number;
}

export const STOPWORDS = new Set(
  (
    "a o e é as os um uma uns umas de do da dos das em no na nos nas por pelo pela pelos pelas para pra pro " +
    "com sem sob sobre entre ate até que se ao aos à às ou mas mais menos muito muita muitos muitas pouco " +
    "já ja não nao sim tambem também como quando onde qual quais quem cujo esse essa esses essas este esta " +
    "estes estas isso isto aquele aquela aquilo ele ela eles elas eu tu voce você voces vocês nos nós vos " +
    "meu minha meus minhas seu sua seus suas teu tua dele dela deles delas lhe lhes me te ser estar ter ha há " +
    "foi era são sao está esta estão estao tem têm tinha vai vou vamos fazer faz feito bem bom boa dia oi ola olá " +
    "obrigado obrigada tudo todo toda todos todas aqui ali la lá então entao porque pois so só cada outro outra"
  ).split(/\s+/),
);

/** Minúsculo, sem acento, só letras e números. */
export function normalizar(texto: string): string {
  return (texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * As palavras que contam: sem acento, sem palavra vazia, com 3+ letras, e com
 * um radical bem simples (tira o plural "s" e o "es"), para "lareiras" casar
 * com "lareira" e "preços" com "preço".
 */
export function palavras(texto: string): string[] {
  return normalizar(texto)
    .split(" ")
    .filter((p) => p.length >= 3 && !STOP_SEM_ACENTO.has(p))
    .map(radical);
}

const STOP_SEM_ACENTO = new Set([...STOPWORDS].map(normalizar));

function radical(p: string): string {
  if (p.length > 5 && p.endsWith("oes")) return `${p.slice(0, -3)}ao`; // instalações → instalacao
  if (p.length > 5 && p.endsWith("es") && /[rz]es$/.test(p)) return p.slice(0, -2); // valores → valor
  if (p.length > 4 && p.endsWith("s")) return p.slice(0, -1);
  return p;
}

/** Estimativa de tokens: ~4 caracteres por token em português. */
export function estimarTokens(texto: string): number {
  return Math.ceil((texto ?? "").length / 4);
}

const DIA = 86_400_000;

/**
 * A nota de um item. Três partes:
 *   relevância (peso maior): fração das palavras da consulta que o item tem,
 *              mais a nota do banco quando o trecho veio da busca dele;
 *   resultado: vezes que fechou venda (em log, para um campeão antigo não
 *              tapar todo o resto), menos um pouco do que perdeu;
 *   recência:  cai pela metade a cada ~180 dias.
 */
export function pontuar(item: ItemConhecimento, termos: Set<string>, agora: Date = new Date()): number {
  let relevancia = 0;
  if (termos.size) {
    const doItem = new Set(palavras(item.busca));
    let comuns = 0;
    for (const t of termos) if (doItem.has(t)) comuns += 1;
    relevancia = comuns / termos.size;
    if (item.notaBanco && item.notaBanco > 0) relevancia += Math.min(1, item.notaBanco);
  }
  const fechou = Math.log2(1 + Math.max(0, item.vezesFechou ?? 0));
  const visto = Math.log2(1 + Math.max(0, item.vezesVisto ?? 0)) * 0.25;
  const perdeu = Math.log2(1 + Math.max(0, item.vezesPerdeu ?? 0)) * 0.5;
  const t = item.criadoEm ? new Date(item.criadoEm).getTime() : NaN;
  const dias = Number.isFinite(t) ? Math.max(0, (agora.getTime() - t) / DIA) : 365;
  const recencia = 1 / (1 + dias / 180);
  return relevancia * 10 + fechou * 1.5 + visto - perdeu + recencia;
}

/**
 * Ordena pela nota e enche o orçamento com itens INTEIROS: o que não cabe é
 * pulado e o seguinte, menor, ainda pode entrar. Com consulta, item sem
 * nenhuma palavra em comum não entra (não é relevante, só seria ruído).
 * Empate desempata pelo id, para o mesmo pedido dar sempre o mesmo texto
 * (o prompt fica igual e o cache da IA aproveita).
 */
export function ranquear(
  itens: ItemConhecimento[],
  consulta: string,
  orcamentoTokens: number,
  agora: Date = new Date(),
): ItemConhecimento[] {
  const termos = new Set(palavras(consulta ?? ""));
  const comNota = itens
    .map((item) => ({ item, nota: pontuar(item, termos, agora) }))
    .filter(({ item }) => {
      if (!termos.size) return true;
      if (item.notaBanco && item.notaBanco > 0) return true;
      const doItem = new Set(palavras(item.busca));
      for (const t of termos) if (doItem.has(t)) return true;
      return false;
    })
    .sort((a, b) => b.nota - a.nota || a.item.id.localeCompare(b.item.id));

  const saida: ItemConhecimento[] = [];
  let usado = 0;
  for (const { item } of comNota) {
    const custo = estimarTokens(item.texto) + 1;
    if (usado + custo > orcamentoTokens) continue;
    saida.push(item);
    usado += custo;
  }
  return saida;
}

/* ------------------------------------------------------------------ */
/* Leitura no banco                                                    */
/* ------------------------------------------------------------------ */

const ROTULO: Record<string, string> = {
  objecao: "Objeção",
  pergunta: "Pergunta de cliente",
  abordagem: "Abordagem",
};

interface LinhaAprendizado {
  id: string;
  tipo: string;
  gatilho: string;
  resposta: string;
  vezes_visto: number | null;
  vezes_fechou: number | null;
  vezes_perdeu: number | null;
  criado_em: string | null;
}

/** O formato que o prompt sempre usou para um aprendizado. */
export function textoDeUmAprendizado(a: {
  tipo: string;
  gatilho: string;
  resposta: string;
  vezes_visto?: number | null;
  vezes_fechou?: number | null;
  vezes_perdeu?: number | null;
}): string {
  const partes = [`visto ${a.vezes_visto ?? 0}x`];
  if ((a.vezes_fechou ?? 0) > 0) partes.push(`fechou ${a.vezes_fechou}x`);
  if ((a.vezes_perdeu ?? 0) > 0) partes.push(`perdeu ${a.vezes_perdeu}x`);
  return `- ${ROTULO[a.tipo] ?? a.tipo}: "${a.gatilho}" (${partes.join(", ")})\n  Resposta que funcionou: ${a.resposta}`;
}

/** Todos os aprendizados APROVADOS da loja, como itens ranqueáveis. */
export async function aprendizadosAprovados(sb: SupabaseClient, empresa: string): Promise<ItemConhecimento[]> {
  const linhas = await todasAsLinhas<LinhaAprendizado>((de, ate) =>
    sb
      .from("aura_aprendizado")
      .select("id, tipo, gatilho, resposta, vezes_visto, vezes_fechou, vezes_perdeu, criado_em")
      .eq("empresa", empresa)
      .eq("status", "aprovado")
      .order("id")
      .range(de, ate),
  );
  return linhas.map((a) => ({
    tipo: "aprendizado" as const,
    id: a.id,
    texto: textoDeUmAprendizado(a),
    busca: `${a.gatilho} ${a.resposta}`,
    criadoEm: a.criado_em,
    vezesFechou: a.vezes_fechou ?? 0,
    vezesVisto: a.vezes_visto ?? 0,
    vezesPerdeu: a.vezes_perdeu ?? 0,
  }));
}

/**
 * O conhecimento aprovado mais relevante para `consulta`, dentro de
 * `orcamentoTokens`. Aprendizados (todos os aprovados da loja) e trechos
 * dos materiais (os que a busca do banco achou para a consulta — o núcleo
 * do manual entra por nucleoDoManual, sempre, e não conta aqui).
 */
export async function recuperarConhecimento(
  sb: SupabaseClient,
  opcoes: { empresa: string; consulta: string; orcamentoTokens: number; incluirTrechos?: boolean; agora?: Date },
): Promise<{ itens: ItemConhecimento[]; texto: string; tokens: number }> {
  const [aprendizados, trechos] = await Promise.all([
    aprendizadosAprovados(sb, opcoes.empresa).catch(() => [] as ItemConhecimento[]),
    opcoes.incluirTrechos === false || !palavras(opcoes.consulta).length
      ? Promise.resolve([] as ItemConhecimento[])
      : import("@/lib/aura/trechos")
          .then(({ trechosRelevantes }) => trechosRelevantes(sb, opcoes.empresa, opcoes.consulta, 20))
          .then((lista) =>
            lista.map((t, i) => ({
              tipo: "trecho" as const,
              id: `trecho-${i}-${normalizar(t.origem).slice(0, 40)}`,
              texto: `### ${t.origem}\n${t.texto}`,
              busca: `${t.origem} ${t.texto}`,
              notaBanco: Number(t.nota) || 0,
            })),
          )
          .catch(() => [] as ItemConhecimento[]),
  ]);
  const itens = ranquear([...aprendizados, ...trechos], opcoes.consulta, opcoes.orcamentoTokens, opcoes.agora);
  const texto = itens.map((i) => i.texto).join("\n");
  return { itens, texto, tokens: estimarTokens(texto) };
}
