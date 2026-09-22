import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface MensagemSalva {
  id: string;
  autor: "usuario" | "aura";
  texto: string;
}

export interface ConversaSalva {
  id: string;
  titulo: string;
  updated_at: string;
}

function truncarTitulo(texto: string) {
  const limpo = texto.trim().replace(/\s+/g, " ");
  return limpo.length > 42 ? `${limpo.slice(0, 42)}…` : limpo;
}

export async function listarConversas(): Promise<ConversaSalva[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("coach_conversas")
    .select("id, titulo, updated_at")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Erro ao listar conversas da AURA Coach:", error);
    return null;
  }

  return data as ConversaSalva[];
}

export async function criarConversa(tituloInicial?: string): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("coach_conversas")
    .insert({ owner_id: user.id, titulo: tituloInicial ? truncarTitulo(tituloInicial) : "Nova conversa" })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Erro ao criar conversa da AURA Coach:", error);
    return null;
  }

  return data.id as string;
}

export async function renomearConversa(conversaId: string, titulo: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  await supabase
    .from("coach_conversas")
    .update({ titulo: truncarTitulo(titulo), updated_at: new Date().toISOString() })
    .eq("id", conversaId);
}

export async function apagarConversa(conversaId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  await supabase.from("coach_conversas").delete().eq("id", conversaId);
}

export async function carregarMensagens(conversaId: string): Promise<MensagemSalva[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("coach_mensagens")
    .select("id, autor, texto")
    .eq("conversa_id", conversaId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erro ao carregar mensagens da conversa:", error);
    return null;
  }

  return data as MensagemSalva[];
}

export async function salvarMensagemCoach(conversaId: string, autor: "usuario" | "aura", texto: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("coach_mensagens")
    .insert({ owner_id: user.id, conversa_id: conversaId, autor, texto });

  if (error) console.error("Erro ao salvar mensagem da AURA Coach:", error);

  await supabase
    .from("coach_conversas")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversaId);
}
