import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface Treinamento {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: string | null;
  link: string | null;
  concluido: boolean;
}

export async function listarTreinamentos(): Promise<Treinamento[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: treinamentos, error }, { data: progresso }] = await Promise.all([
    supabase.from("treinamentos").select("*").order("created_at", { ascending: true }),
    supabase.from("treinamento_progresso").select("treinamento_id, concluido").eq("owner_id", user.id),
  ]);

  if (error || !treinamentos) {
    console.error("Erro ao carregar treinamentos:", error);
    return [];
  }

  const progressoMap = new Map((progresso ?? []).map((p) => [p.treinamento_id, p.concluido]));

  return treinamentos.map((t) => ({
    id: t.id,
    titulo: t.titulo,
    descricao: t.descricao,
    categoria: t.categoria,
    link: t.link,
    concluido: progressoMap.get(t.id) ?? false,
  }));
}

export async function alternarConclusao(treinamentoId: string, concluido: boolean) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase.from("treinamento_progresso").upsert(
    {
      owner_id: user.id,
      treinamento_id: treinamentoId,
      concluido,
      concluido_em: concluido ? new Date().toISOString() : null,
    },
    { onConflict: "owner_id,treinamento_id" }
  );

  if (error) console.error("Erro ao atualizar progresso:", error);
}

export async function criarTreinamento(dados: {
  empresa: string;
  titulo: string;
  descricao?: string;
  categoria?: string;
  link?: string;
}) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("treinamentos")
    .insert({
      empresa: dados.empresa,
      titulo: dados.titulo,
      descricao: dados.descricao ?? null,
      categoria: dados.categoria ?? null,
      link: dados.link ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("Erro ao criar treinamento:", error);
    return null;
  }
  return data;
}

export async function apagarTreinamento(id: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const { error } = await supabase.from("treinamentos").delete().eq("id", id);
  if (error) console.error("Erro ao apagar treinamento:", error);
}
