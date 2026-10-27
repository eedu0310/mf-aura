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
  vezes_perdeu: number;
  aprovado_auto: boolean;
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
      .select("tipo, gatilho, resposta, vezes_visto, vezes_fechou, vezes_perdeu")
      .eq("empresa", empresa)
      .eq("status", "aprovado")
      .order("vezes_fechou", { ascending: false })
      .order("vezes_visto", { ascending: false })
      .limit(120);

    texto = (data ?? [])
      .map((a: Pick<Aprendizado, "tipo" | "gatilho" | "resposta" | "vezes_visto" | "vezes_fechou" | "vezes_perdeu">) => {
        const partes = [`visto ${a.vezes_visto}x`];
        if (a.vezes_fechou > 0) partes.push(`fechou ${a.vezes_fechou}x`);
        if ((a.vezes_perdeu ?? 0) > 0) partes.push(`perdeu ${a.vezes_perdeu}x`);
        const placar = ` (${partes.join(", ")})`;
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
): Promise<{ id: string; novo: boolean } | null> {
  const chave = normalizarChave(entrada.gatilho);
  if (!chave) return null;

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
    if (existente.status === "recusado") return null;
    await sb
      .from("aura_aprendizado")
      .update({
        vezes_visto: existente.vezes_visto + 1,
        vezes_fechou: existente.vezes_fechou + (entrada.fechou ? 1 : 0),
      })
      .eq("id", existente.id);
    await talvezAprovarSozinho(sb, existente.id);
    return { id: existente.id, novo: false };
  }

  const { data: criado } = await sb.from("aura_aprendizado").insert({
    empresa: entrada.empresa,
    canal: entrada.canal,
    tipo: entrada.tipo,
    gatilho: entrada.gatilho.slice(0, 500),
    resposta: entrada.resposta.slice(0, 2000),
    chave,
    vezes_fechou: entrada.fechou ? 1 : 0,
    fonte: entrada.fonte ?? null,
    status: "sugerido",
  }).select("id").maybeSingle();
  return criado?.id ? { id: criado.id as string, novo: true } : null;
}

/*
 * APROVAÇÃO SOZINHA (decisão do Elton, 27/10).
 *
 * Se tudo esperar o gestor, a AURA para de aprender quando a lista acumula.
 * Então o que é seguro entra sozinho: o padrão apareceu em várias conversas,
 * já esteve em negócio fechado, fechou pelo menos tanto quanto perdeu, e o
 * texto não tem número nenhum. Preço, prazo, garantia, desconto, parcela,
 * medida — qualquer dígito ou palavra dessas — continua esperando o gestor,
 * porque um valor errado repetido para todo cliente é exatamente o estrago
 * que o portão de aprovação existe para evitar.
 *
 * O gestor continua mandando: vê o selo "entrou sozinho" e tira de uso com
 * um clique; tirado de uso vira "recusado" e não volta.
 */
export const MIN_VISTO_PARA_APROVAR = 3;
export const MIN_FECHOU_PARA_APROVAR = 1;
const TEXTO_SENSIVEL =
  /\d|r\$|reais|pre[cç]o|valor|custa|desconto|parcel|juros|pix|boleto|cart[aã]o|prazo|garantia|vital[ií]ci|metro|m²|m2|kw|%/i;

export function temTextoSensivel(texto: string): boolean {
  return TEXTO_SENSIVEL.test(texto);
}

export function podeAprovarSozinho(a: {
  status: string;
  gatilho: string;
  resposta: string;
  vezes_visto: number;
  vezes_fechou: number;
  vezes_perdeu?: number | null;
}): boolean {
  if (a.status !== "sugerido") return false;
  if (a.vezes_visto < MIN_VISTO_PARA_APROVAR) return false;
  if (a.vezes_fechou < MIN_FECHOU_PARA_APROVAR) return false;
  if (a.vezes_fechou < (a.vezes_perdeu ?? 0)) return false;
  return !temTextoSensivel(`${a.gatilho} ${a.resposta}`);
}

export async function talvezAprovarSozinho(sb: SupabaseClient, id: string): Promise<boolean> {
  const { data: a } = await sb
    .from("aura_aprendizado")
    .select("id, empresa, status, gatilho, resposta, vezes_visto, vezes_fechou, vezes_perdeu")
    .eq("id", id)
    .maybeSingle();
  if (!a || !podeAprovarSozinho(a)) return false;
  const { data: mudou } = await sb
    .from("aura_aprendizado")
    .update({ status: "aprovado", aprovado_auto: true, revisado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "sugerido")
    .select("id");
  if (!mudou?.length) return false;
  limparCacheAprendizado(a.empresa as string);
  return true;
}

/**
 * Liga um aprendizado à conversa de onde ele saiu, para o placar acompanhar o
 * que acontecer com aquele negócio depois.
 */
export async function ligarOrigem(
  sb: SupabaseClient,
  origem: {
    aprendizadoId: string;
    empresa: string;
    ownerId: string;
    chatJid: string;
    oportunidadeId?: string | null;
    relacionamentoId?: string | null;
  },
): Promise<void> {
  const { error } = await sb.from("aura_aprendizado_origem").upsert(
    {
      aprendizado_id: origem.aprendizadoId,
      empresa: origem.empresa,
      owner_id: origem.ownerId,
      chat_jid: origem.chatJid,
      oportunidade_id: origem.oportunidadeId ?? null,
      relacionamento_id: origem.relacionamentoId ?? null,
    },
    { onConflict: "aprendizado_id,owner_id,chat_jid", ignoreDuplicates: true },
  );
  if (error) console.error("[aprendizado] ligar origem:", error.message);
}

/**
 * O negócio de onde saíram aprendizados foi decidido: cada aprendizado ligado
 * a ele ganha um ponto de fechou ou de perdeu, e o que ficou seguro e
 * comprovado pode entrar em uso sozinho. Devolve quantos entraram em uso.
 */
export async function registrarResultadoDasOrigens(
  sb: SupabaseClient,
  dados: { oportunidadeId: string | null; relacionamentoId: string | null; resultado: "fechado" | "perdido" },
): Promise<number> {
  const filtros: string[] = [];
  if (dados.oportunidadeId) filtros.push(`oportunidade_id.eq.${dados.oportunidadeId}`);
  if (dados.relacionamentoId) filtros.push(`relacionamento_id.eq.${dados.relacionamentoId}`);
  if (!filtros.length) return 0;

  const { data: origens } = await sb
    .from("aura_aprendizado_origem")
    .select("id, aprendizado_id")
    .is("resultado", null)
    .or(filtros.join(","));
  if (!origens?.length) return 0;

  await sb
    .from("aura_aprendizado_origem")
    .update({ resultado: dados.resultado, resolvido_em: new Date().toISOString() })
    .in("id", origens.map((o: { id: string }) => o.id));

  let aprovados = 0;
  const ids = [...new Set(origens.map((o: { aprendizado_id: string }) => o.aprendizado_id))];
  for (const id of ids) {
    const { data: a } = await sb
      .from("aura_aprendizado")
      .select("vezes_fechou, vezes_perdeu, status")
      .eq("id", id)
      .maybeSingle();
    if (!a || a.status === "recusado") continue;
    await sb
      .from("aura_aprendizado")
      .update(
        dados.resultado === "fechado"
          ? { vezes_fechou: (a.vezes_fechou ?? 0) + 1 }
          : { vezes_perdeu: (a.vezes_perdeu ?? 0) + 1 },
      )
      .eq("id", id);
    if (await talvezAprovarSozinho(sb, id)) aprovados++;
  }
  return aprovados;
}
