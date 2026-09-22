import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Retorna um cliente Supabase para uso em Server Components, Route Handlers
 * e Server Actions. Retorna null se as variáveis de ambiente não estiverem
 * configuradas (modo demonstração).
 */
export async function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Chamado a partir de um Server Component — pode ser ignorado
          // se houver um middleware atualizando a sessão.
        }
      },
    },
  });
}
