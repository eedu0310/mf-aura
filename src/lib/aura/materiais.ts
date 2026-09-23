/**
 * Materiais que a AURA estuda (manual de vendas, playbook, tabela de produtos).
 * O gestor envia pelo painel; aqui o texto é lido para entrar nos prompts.
 */
import fs from "fs";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface Material {
  id: string;
  empresa: string;
  titulo: string;
  descricao: string | null;
  arquivo_nome: string | null;
  tipo: string | null;
  bytes: number | null;
  caracteres: number;
  ativo: boolean;
  criado_em: string;
}

const LIMITE_PROMPT = 40_000;
const CACHE_MS = 5 * 60 * 1000;

const g = globalThis as unknown as { __auraMateriais?: Map<string, { at: number; texto: string }> };
const cache = (g.__auraMateriais ??= new Map());

/** Arquivos soltos na pasta manual-treinamento (usados enquanto não há upload). */
function daPasta(): string {
  try {
    const dir = path.join(process.cwd(), "manual-treinamento");
    return fs
      .readdirSync(dir)
      .filter((f) => /\.(md|txt)$/i.test(f))
      .map((f) => `### ${f}\n${fs.readFileSync(path.join(dir, f), "utf8")}`)
      .join("\n\n");
  } catch {
    return "";
  }
}

export function limparCacheMateriais(empresa?: string) {
  if (empresa) cache.delete(empresa);
  else cache.clear();
}

/** Texto dos materiais da loja para colocar no prompt da IA. */
export async function textoDosMateriais(sb: SupabaseClient, empresa: string): Promise<string> {
  const hit = cache.get(empresa);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.texto;

  let texto = "";
  try {
    const { data } = await sb
      .from("aura_materiais")
      .select("titulo, descricao, texto")
      .eq("empresa", empresa)
      .eq("ativo", true)
      .order("criado_em", { ascending: true });
    texto = (data ?? [])
      .map((m) => `### ${m.titulo}${m.descricao ? ` — ${m.descricao}` : ""}\n${m.texto}`)
      .join("\n\n");
  } catch {
    texto = "";
  }

  if (!texto) texto = daPasta();
  if (texto.length > LIMITE_PROMPT) texto = `${texto.slice(0, LIMITE_PROMPT)}\n\n[...material cortado por tamanho...]`;
  cache.set(empresa, { at: Date.now(), texto });
  return texto;
}
