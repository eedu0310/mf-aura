import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface Faq {
  id: string;
  pergunta: string;
  resposta: string;
  link: string | null;
}

export async function listarFaq(): Promise<Faq[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("perguntas_frequentes")
    .select("id, pergunta, resposta, link")
    .order("ordem", { ascending: true });

  if (error) {
    console.error("Erro ao carregar FAQ:", error);
    return [];
  }
  return data ?? [];
}

export async function criarFaq(dados: {
  empresa: string;
  pergunta: string;
  resposta: string;
  link?: string;
  ordem?: number;
}) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("perguntas_frequentes")
    .insert({
      empresa: dados.empresa,
      pergunta: dados.pergunta,
      resposta: dados.resposta,
      link: dados.link ?? null,
      ordem: dados.ordem ?? 0,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("Erro ao criar FAQ:", error);
    return null;
  }
  return data;
}

export async function apagarFaq(id: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const { error } = await supabase.from("perguntas_frequentes").delete().eq("id", id);
  if (error) console.error("Erro ao apagar FAQ:", error);
}
