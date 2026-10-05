import { getSupabaseServerClient } from "@/lib/supabase/server";
import { carregarDados, podeVerTudo, type DadosCrm } from "./dados";

/** Usuário logado + dados do CRM que ELE pode ver (regras de loja do banco). */
export async function sessaoAura(opts?: { diasAtividades?: number; diasVendas?: number }) {
  const sb = await getSupabaseServerClient();
  if (!sb) return { erro: "Supabase não configurado.", status: 500 as const };
  const { data } = await sb.auth.getUser();
  const user = data.user;
  if (!user) return { erro: "Faça login novamente.", status: 401 as const };
  const dados = await carregarDados(sb, user.id, opts);
  if (!dados) return { erro: "Perfil não encontrado.", status: 404 as const };
  return { sb, userId: user.id, dados: dados as DadosCrm, gestor: podeVerTudo(dados.perfil) };
}
