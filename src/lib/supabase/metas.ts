import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function mesAtualISO() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
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
  const existente = await supabase.from("metas").select("id").eq("owner_id", user.id).eq("mes", mes).maybeSingle();
  const resultado = existente.data?.id
    ? await supabase.from("metas").update({ valor_meta: valor }).eq("id", existente.data.id)
    : await supabase.from("metas").insert({ owner_id: user.id, mes, valor_meta: valor });
  const error = resultado.error;

  if (error) {
    console.error("Erro ao definir meta:", error);
    return false;
  }
  return true;
}

/** Gestor/Diretor: busca a meta do mês de um vendedor específico. */
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

/** Gestor/Diretor: busca as metas do mês de TODOS os vendedores de
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

/** Gestor/Diretor: define a meta do mês de um vendedor específico. */
export async function definirMetaDeVendedor(vendedorId: string, valor: number): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("metas")
    .upsert(
      { owner_id: vendedorId, mes: mesAtualISO(), valor_meta: valor },
      { onConflict: "owner_id,mes" }
    );

  if (error) {
    console.error("Erro ao definir meta do vendedor:", error);
    return false;
  }
  return true;
}
