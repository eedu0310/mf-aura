import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mesEmSaoPaulo } from "@/lib/fuso";

// Mês de Brasília: pelo relógio do navegador, quem abria a tela fora do fuso
// (ou na virada do mês) gravava a meta no mês errado.
function mesAtualISO() {
  return mesEmSaoPaulo();
}

/**
 * Loja e ano da meta.
 *
 * As 5 metas gravadas estavam com empresa e ano vazios: estas funções só
 * mandavam dono, mês e valor. Quem lê as metas por loja (os números da AURA,
 * aura/dados.ts) não achava nenhuma. A loja é a do VENDEDOR dono da meta —
 * não a de quem está definindo, que pode ser o gestor de outra loja.
 */
async function lojaEAnoDaMeta(
  supabase: SupabaseClient,
  ownerId: string,
  mes: string,
): Promise<{ ano: number; empresa?: string }> {
  const { data } = await supabase.from("profiles").select("empresa").eq("id", ownerId).maybeSingle();
  const empresa = typeof data?.empresa === "string" && data.empresa.trim() ? data.empresa : undefined;
  // Sem loja lida (RLS, perfil sem loja), não manda o campo: não apaga uma
  // loja que já estivesse gravada.
  return { ano: Number(mes.slice(0, 4)), ...(empresa ? { empresa } : {}) };
}

export async function buscarMetaDoMes(): Promise<number | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("metas")
    .select("valor_meta")
    .eq("owner_id", user.id)
    .eq("mes", mesAtualISO())
    .maybeSingle();

  return data ? Number(data.valor_meta) : null;
}

export async function definirMetaDoMes(valor: number): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const mes = mesAtualISO();
  const lojaEAno = await lojaEAnoDaMeta(supabase, user.id, mes);
  const existente = await supabase.from("metas").select("id").eq("owner_id", user.id).eq("mes", mes).maybeSingle();
  const resultado = existente.data?.id
    ? await supabase.from("metas").update({ valor_meta: valor, ...lojaEAno }).eq("id", existente.data.id)
    : await supabase.from("metas").insert({ owner_id: user.id, mes, valor_meta: valor, ...lojaEAno });
  const error = resultado.error;

  if (error) {
    console.error("Erro ao definir meta:", error);
    return false;
  }
  return true;
}

/** Gestor: busca a meta do mês de um vendedor específico. */
export async function buscarMetaDeVendedor(vendedorId: string): Promise<number | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("metas")
    .select("valor_meta")
    .eq("owner_id", vendedorId)
    .eq("mes", mesAtualISO())
    .maybeSingle();

  return data ? Number(data.valor_meta) : null;
}

/** Gestor: busca as metas do mês de TODOS os vendedores de
 *  uma vez (mapa vendedorId -> valor), pra mostrar na equipe. */
export async function buscarMetasDoMesEquipe(): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return mapa;

  const { data } = await supabase
    .from("metas")
    .select("owner_id, valor_meta")
    .eq("mes", mesAtualISO());

  for (const linha of data ?? []) {
    mapa.set(linha.owner_id as string, Number(linha.valor_meta));
  }
  return mapa;
}

/** Gestor: define a meta do mês de um vendedor específico. */
export async function definirMetaDeVendedor(vendedorId: string, valor: number): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  const mes = mesAtualISO();
  const lojaEAno = await lojaEAnoDaMeta(supabase, vendedorId, mes);
  const { error } = await supabase
    .from("metas")
    .upsert(
      { owner_id: vendedorId, mes, valor_meta: valor, ...lojaEAno },
      { onConflict: "owner_id,mes" }
    );

  if (error) {
    console.error("Erro ao definir meta do vendedor:", error);
    return false;
  }
  return true;
}
