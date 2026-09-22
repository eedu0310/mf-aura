import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface LinkUtil {
  id: string;
  titulo: string;
  url: string;
  categoria: string | null;
}

export async function listarLinks(): Promise<LinkUtil[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("links_uteis")
    .select("id, titulo, url, categoria")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erro ao carregar links:", error);
    return [];
  }
  return data ?? [];
}

export async function criarLink(dados: { empresa: string; titulo: string; url: string; categoria?: string }) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("links_uteis")
    .insert({
      empresa: dados.empresa,
      titulo: dados.titulo,
      url: dados.url,
      categoria: dados.categoria ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("Erro ao criar link:", error);
    return null;
  }
  return data;
}

export async function apagarLink(id: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const { error } = await supabase.from("links_uteis").delete().eq("id", id);
  if (error) console.error("Erro ao apagar link:", error);
}
