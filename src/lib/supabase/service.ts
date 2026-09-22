import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com a chave de serviço (privilégio total, ignora RLS).
 * NUNCA importar isso em código que roda no navegador — só em rotas de
 * API que precisam agir "por fora" de um usuário logado, como o webhook
 * do WhatsApp e a tarefa agendada de repasse de leads.
 */
export function getSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !chaveServico) return null;

  return createClient(url, chaveServico, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
