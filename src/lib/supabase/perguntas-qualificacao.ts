import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface PerguntaQualificacao {
  id: string;
  ordem: number;
  pergunta: string;
}

export async function listarPerguntasQualificacao(): Promise<PerguntaQualificacao[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  /*
   * A tabela NÃO tem coluna "ordem" (pente fino de 25/11/2026): a consulta
   * pedia essa coluna, o banco recusava e a lista vinha sempre vazia. A ordem
   * é a de criação, e o número sai da posição na lista.
   */
  const { data, error } = await supabase
    .from("perguntas_qualificacao")
    .select("id, pergunta, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erro ao carregar perguntas de qualificação:", error);
    return [];
  }
  return (data ?? []).map((p, i) => ({ id: p.id as string, pergunta: p.pergunta as string, ordem: i + 1 }));
}

// `_ordem` fica na assinatura por quem já chama; a tabela não guarda ordem.
export async function criarPerguntaQualificacao(empresa: string, pergunta: string, _ordem?: number) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("perguntas_qualificacao")
    .insert({ empresa, pergunta })
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
