import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type TipoCompromisso = "Visita" | "Reunião" | "Follow-up" | "Ligação" | "Outro";

export interface Compromisso {
  id: string;
  titulo: string;
  subtitulo: string | null;
  tipo: TipoCompromisso;
  relacionamentoNome: string | null;
  data: string; // YYYY-MM-DD
  hora: string | null;
  concluido: boolean;
  ownerId: string;
}

export function compromissoDoBanco(linha: Record<string, unknown>): Compromisso {
  return {
    id: linha.id as string,
    titulo: linha.titulo as string,
    subtitulo: (linha.subtitulo as string) ?? null,
    tipo: linha.tipo as TipoCompromisso,
    relacionamentoNome: (linha.relacionamento_nome as string) ?? null,
    data: linha.data as string,
    hora: (linha.hora as string) ?? null,
    concluido: Boolean(linha.concluido),
    ownerId: linha.owner_id as string,
  };
}

export async function listarCompromissos(): Promise<Compromisso[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("compromissos")
    .select("*")
    .order("data", { ascending: true })
    .order("hora", { ascending: true });

  if (error) {
    console.error("Erro ao carregar agenda:", error);
    return [];
  }
  return (data ?? []).map(compromissoDoBanco);
}

export async function criarCompromisso(dados: {
  titulo: string;
  subtitulo?: string;
  tipo: TipoCompromisso;
  relacionamentoNome?: string;
  data: string;
  hora?: string;
}): Promise<Compromisso | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: linha, error } = await supabase
    .from("compromissos")
    .insert({
      owner_id: user.id,
      titulo: dados.titulo,
      subtitulo: dados.subtitulo ?? null,
      tipo: dados.tipo,
      relacionamento_nome: dados.relacionamentoNome ?? null,
      data: dados.data,
      hora: dados.hora ?? null,
    })
    .select()
    .single();

  if (error || !linha) {
    console.error("Erro ao criar compromisso:", error);
    return null;
  }
  return compromissoDoBanco(linha);
}

export async function atualizarCompromisso(id: string, patch: Partial<Compromisso>) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const payload: Record<string, unknown> = {};
  if (patch.titulo !== undefined) payload.titulo = patch.titulo;
  if (patch.subtitulo !== undefined) payload.subtitulo = patch.subtitulo;
  if (patch.tipo !== undefined) payload.tipo = patch.tipo;
  if (patch.relacionamentoNome !== undefined) payload.relacionamento_nome = patch.relacionamentoNome;
  if (patch.data !== undefined) payload.data = patch.data;
  if (patch.hora !== undefined) payload.hora = patch.hora;
  if (patch.concluido !== undefined) payload.concluido = patch.concluido;

  const { error } = await supabase.from("compromissos").update(payload).eq("id", id);
  if (error) console.error("Erro ao atualizar compromisso:", error);
}

export async function apagarCompromisso(id: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const { error } = await supabase.from("compromissos").delete().eq("id", id);
  if (error) console.error("Erro ao apagar compromisso:", error);
}
