import { getSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("profiles")
    .select("empresa, cargo, ativo")
    .eq("id", user.id)
    .single();

  if (!perfil) return null;
  // Conta desativada pelo gestor não responde mais por nenhuma rota.
  if (perfil.ativo === false) return null;

  return { supabase, empresa: perfil.empresa as string, cargo: perfil.cargo as string, userId: user.id };
}
