/**
 * O que a AURA aprendeu com as conversas reais da casa.
 *
 * Os materiais (aura/materiais.ts) são o conhecimento que o gestor sobe: manual,
 * playbook, tabela de produtos. Este arquivo é o outro lado: a objeção que o
 * cliente levantou de verdade no WhatsApp ou no Instagram e a resposta que
 * destravou a venda, acumuladas dia após dia.
 *
 * Uma ressalva que vale deixar escrita, porque é fácil de entender errado: o
 * modelo de IA não muda com o uso, os pesos dele são fixos. Quem aprende é o
 * sistema — ele junta o conhecimento aqui e passa a injetar nos prompts. O
 * efeito prático é o que se espera (a AURA vai ficando melhor no nosso ramo,
 * com as nossas palavras e os nossos preços), mas por acúmulo do nosso
 * conhecimento, não por treino do modelo.
 *
 * Só entra no prompt o que o gestor aprovou. Sem esse portão, a IA passaria a
 * reforçar os próprios erros: um preço errado que apareceu numa conversa viraria
 * o preço que ela repete para todos os clientes.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type TipoAprendizado = "objecao" | "pergunta" | "abordagem";

export interface Aprendizado {
  id: string;
  empresa: string;
  canal: string;
  tipo: TipoAprendizado;
  gatilho: string;
  resposta: string;
  vezes_visto: number;
  vezes_fechou: number;
  status: "sugerido" | "aprovado" | "recusado";
  criado_em: string;
}

/** Menor que o dos materiais de propósito: o manual é a regra da casa e não
 *  pode ser empurrado para fora do prompt pelo que foi aprendido. */
const LIMITE_PROMPT = 8_000;
const CACHE_MS = 5 * 60 * 1000;

const g = globalThis as unknown as {
  __auraAprendizado?: Map<string, { at: number; texto: string }>;
};
const cache = (g.__auraAprendizado ??= new Map());

export function limparCacheAprendizado(empresa?: string) {
  if (empresa) cache.delete(empresa);
  else cache.clear();
}

/**
 * Chave de dedupe. O processo diário roda toda noite sobre conversas parecidas;
 * sem normalizar, a mesma objeção entraria de novo todos os dias. Com a chave,
 * ele incrementa o contador do padrão que já existe.
 */
export function normalizarChave(gatilho: string): string {
  return gatilho
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // tira acento: "não" e "nao" são o mesmo
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

const ROTULO: Record<TipoAprendizado, string> = {
  objecao: "Objeção",
  pergunta: "Pergunta de cliente",
  abordagem: "Abordagem",
};

/**
 * Texto do aprendizado aprovado da loja, pronto para entrar no prompt.
 * Vem ordenado pelo que mais fechou venda, porque o texto é cortado por tamanho
 * e o que fecha mais é o que deve sobreviver ao corte.
 */
export async function textoDoAprendizado(
  sb: SupabaseClient,
  empresa: string,
): Promise<string> {
  const hit = cache.get(empresa);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.texto;

  let texto = "";
  try {
    const { data } = await sb
      .from("aura_aprendizado")
      .select("tipo, gatilho, resposta, vezes_visto, vezes_fechou")
      .eq("empresa", empresa)
      .eq("status", "aprovado")
      .order("vezes_fechou", { ascending: false })
      .order("vezes_visto", { ascending: false })
      .limit(120);

    texto = (data ?? [])
      .map((a: Pick<Aprendizado, "tipo" | "gatilho" | "resposta" | "vezes_visto" | "vezes_fechou">) => {
        const placar =
          a.vezes_fechou > 0
            ? ` (visto ${a.vezes_visto}x, fechou ${a.vezes_fechou}x)`
            : ` (visto ${a.vezes_visto}x)`;
        return `- ${ROTULO[a.tipo] ?? a.tipo}: "${a.gatilho}"${placar}\n  Resposta que funcionou: ${a.resposta}`;
      })
      .join("\n");
  } catch {
    texto = "";
  }

  if (texto.length > LIMITE_PROMPT) {
    texto = `${texto.slice(0, LIMITE_PROMPT)}\n[...aprendizado cortado por tamanho...]`;
  }
  cache.set(empresa, { at: Date.now(), texto });
  return texto;
}

/** Bloco pronto para colar no system prompt. Vazio quando ainda não há nada
 *  aprovado, para não enfiar cabeçalho órfão no prompt. */
export function blocoDeAprendizado(texto: string): string {
  if (!texto.trim()) return "";
  return `

O QUE JÁ APRENDEMOS NAS NOSSAS CONVERSAS (casos reais desta loja, revisados pelo gestor):
Use isto como primeira referência, porque são as palavras e os valores que já
funcionaram com os nossos clientes. Se conflitar com o MANUAL, o manual manda.
${texto}`;
}

/**
 * Guarda um padrão aprendido. Nasce como "sugerido": ninguém usa até o gestor
 * aprovar. Se o padrão já existe, incrementa os contadores em vez de duplicar.
 */
export async function guardarAprendizado(
  sb: SupabaseClient,
  entrada: {
    empresa: string;
    canal: string;
    tipo: TipoAprendizado;
    gatilho: string;
    resposta: string;
    fechou?: boolean;
    fonte?: string;
  },
): Promise<void> {
  const chave = normalizarChave(entrada.gatilho);
  if (!chave) return;

  const { data: existente } = await sb
    .from("aura_aprendizado")
    .select("id, vezes_visto, vezes_fechou, status")
    .eq("empresa", entrada.empresa)
    .eq("canal", entrada.canal)
    .eq("tipo", entrada.tipo)
    .eq("chave", chave)
    .maybeSingle();

  if (existente) {
    // Um padrão recusado pelo gestor não volta por insistência do processo:
    // ele decidiu que aquilo não serve, e reabrir seria desfazer a decisão dele.
    if (existente.status === "recusado") return;
    await sb
      .from("aura_aprendizado")
      .update({
        vezes_visto: existente.vezes_visto + 1,
        vezes_fechou: existente.vezes_fechou + (entrada.fechou ? 1 : 0),
      })
      .eq("id", existente.id);
    return;
  }

  await sb.from("aura_aprendizado").insert({
    empresa: entrada.empresa,
    canal: entrada.canal,
    tipo: entrada.tipo,
    gatilho: entrada.gatilho.slice(0, 500),
    resposta: entrada.resposta.slice(0, 2000),
    chave,
    vezes_fechou: entrada.fechou ? 1 : 0,
    fonte: entrada.fonte ?? null,
    status: "sugerido",
  });
}
