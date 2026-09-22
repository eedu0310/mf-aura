import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface NivelPerformance {
  id: string;
  ordem: number;
  nome: string;
  metaValor: number;
  premio: string | null;
}

export async function listarNiveis(): Promise<NivelPerformance[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("niveis_performance")
    .select("id, ordem, nome, meta_valor, premio")
    .order("ordem", { ascending: true });

  if (error) {
    console.error("Erro ao carregar níveis:", error);
    return [];
  }
  return (data ?? []).map((n) => ({
    id: n.id,
    ordem: n.ordem,
    nome: n.nome,
    metaValor: Number(n.meta_valor),
    premio: n.premio,
  }));
}

export async function criarNivel(dados: {
  empresa: string;
  ordem: number;
  nome: string;
  metaValor: number;
  premio?: string;
}) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("niveis_performance")
    .insert({
      empresa: dados.empresa,
      ordem: dados.ordem,
      nome: dados.nome,
      meta_valor: dados.metaValor,
      premio: dados.premio ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("Erro ao criar nível:", error);
    return null;
  }
  return data;
}

export async function apagarNivel(id: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const { error } = await supabase.from("niveis_performance").delete().eq("id", id);
  if (error) console.error("Erro ao apagar nível:", error);
}
