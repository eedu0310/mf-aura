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
  /**
   * Os dois nomes. O Supabase renomeou a "anon key" para "publishable key" no
   * painel, então uma chave copiada hoje pode chegar com o nome novo. Aceitar
   * os dois custa uma linha e evita um sistema que sobe quebrado só porque o
   * rótulo mudou.
   */
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) {
    // Fica no console do navegador para quem for investigar: a tela mostra a
    // mensagem amigável, mas aqui fica dito qual variável faltou.
    console.error(
      "[supabase] cliente do navegador não criado: falta " +
        [!url && "NEXT_PUBLIC_SUPABASE_URL", !anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY"]
          .filter(Boolean)
          .join(" e "),
    );
    cliente = null;
    return null;
  }

  cliente = createBrowserClient(url, anonKey);
  return cliente;
}
