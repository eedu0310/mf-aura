import { headers } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

/** O proxy já validou a sessão desta requisição e deixou o id aqui. */
const CABECALHO_USUARIO = "x-aura-usuario";

/**
 * Perfil lembrado por um minuto.
 *
 * Empresa e cargo de uma pessoa mudam algumas vezes por ano, e eram
 * consultados em toda requisição. O preço do cache é a janela: promover
 * alguém ou desativar uma conta leva até um minuto para valer nas rotas.
 */
const TTL_PERFIL_MS = 60_000;
const g = globalThis as unknown as {
  __auraPerfis?: Map<string, { empresa: string; cargo: string; ativo: boolean; em: number }>;
};
const perfis = (g.__auraPerfis ??= new Map());

/**
 * Retorna o cliente Supabase (servidor), a empresa e o id do usuário
 * autenticado pela sessão (cookies). Retorna null se não houver
 * Supabase configurado ou sessão válida.
 */
export async function getEmpresaAutenticada(request?: Request) {
  let supabase = await getSupabaseServerClient();
  const token = request?.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (token) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && anonKey) {
      supabase = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
    }
  }
  if (!supabase) return null;

  // Sem token no cabeçalho Authorization, quem manda é a sessão do cookie —
  // e essa o proxy já validou nesta mesma requisição. Com token, a
  // identidade é outra e precisa ser verificada aqui.
  let userId: string | null = null;
  if (!token) {
    userId = (await headers()).get(CABECALHO_USUARIO);
  }
  if (!userId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  }
  if (!userId) return null;

  const lembrado = perfis.get(userId);
  if (lembrado && Date.now() - lembrado.em < TTL_PERFIL_MS) {
    if (!lembrado.ativo) return null;
    return { supabase, empresa: lembrado.empresa, cargo: lembrado.cargo, userId };
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("empresa, cargo, ativo")
    .eq("id", userId)
    .single();

  if (!perfil) return null;

  if (perfis.size >= 500) {
    const maisAntigo = perfis.keys().next().value;
    if (maisAntigo) perfis.delete(maisAntigo);
  }
  perfis.set(userId, {
    empresa: perfil.empresa as string,
    cargo: perfil.cargo as string,
    ativo: perfil.ativo !== false,
    em: Date.now(),
  });

  // Conta desativada pelo gestor não responde mais por nenhuma rota.
  if (perfil.ativo === false) return null;

  return { supabase, empresa: perfil.empresa as string, cargo: perfil.cargo as string, userId };
}
