import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | null | undefined;

/**
 * Retorna um cliente Supabase para uso em componentes do navegador ("use client").
 * Retorna null se as variáveis de ambiente não estiverem configuradas — nesse
 * caso, a aplicação deve seguir funcionando em modo demonstração (em memória).
 *
 * IMPORTANTE: mantém uma única instância (singleton). Criar múltiplas
 * instâncias do cliente Supabase no mesmo navegador é a causa mais comum
 * de sessões que "somem" ao atualizar a página (bug corrigido aqui).
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (cliente !== undefined) return cliente;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    cliente = null;
    return null;
  }

  cliente = createBrowserClient(url, anonKey);
  return cliente;
}
