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
  /** Quanto tempo o compromisso ocupa (usado no calendário do celular). */
  duracaoMinutos: number;
  local: string | null;
  observacao: string | null;
  relacionamentoId: string | null;
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
    duracaoMinutos: Number(linha.duracao_minutos ?? 60),
    local: (linha.local as string) ?? null,
    observacao: (linha.observacao as string) ?? null,
    relacionamentoId: (linha.relacionamento_id as string) ?? null,
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
  duracaoMinutos?: number;
  local?: string;
  observacao?: string;
  relacionamentoId?: string;
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
      duracao_minutos: dados.duracaoMinutos ?? 60,
      local: dados.local?.trim() || null,
      observacao: dados.observacao?.trim() || null,
      relacionamento_id: dados.relacionamentoId ?? null,
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
  if (patch.duracaoMinutos !== undefined) payload.duracao_minutos = patch.duracaoMinutos;
  if (patch.local !== undefined) payload.local = patch.local;
  if (patch.observacao !== undefined) payload.observacao = patch.observacao;
  if (patch.relacionamentoId !== undefined) payload.relacionamento_id = patch.relacionamentoId;
  payload.atualizado_em = new Date().toISOString();

  const { error } = await supabase.from("compromissos").update(payload).eq("id", id);
  if (error) console.error("Erro ao atualizar compromisso:", error);
}

export async function apagarCompromisso(id: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const { error } = await supabase.from("compromissos").delete().eq("id", id);
  if (error) console.error("Erro ao apagar compromisso:", error);
}
