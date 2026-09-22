import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface PerguntaQualificacao {
  id: string;
  ordem: number;
  pergunta: string;
}

export async function listarPerguntasQualificacao(): Promise<PerguntaQualificacao[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("perguntas_qualificacao")
    .select("id, ordem, pergunta")
    .order("ordem", { ascending: true });

  if (error) {
    console.error("Erro ao carregar perguntas de qualificação:", error);
    return [];
  }
  return data ?? [];
}

export async function criarPerguntaQualificacao(empresa: string, pergunta: string, ordem: number) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("perguntas_qualificacao")
    .insert({ empresa, pergunta, ordem })
    .select()
    .single();

  if (error || !data) {
    console.error("Erro ao criar pergunta de qualificação:", error);
    return null;
  }
  return data;
}

export async function apagarPerguntaQualificacao(id: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const { error } = await supabase.from("perguntas_qualificacao").delete().eq("id", id);
  if (error) console.error("Erro ao apagar pergunta de qualificação:", error);
}
