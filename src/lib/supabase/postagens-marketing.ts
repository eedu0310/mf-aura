import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type StatusPostagem = "planejado" | "aguardando_aprovacao" | "aprovado" | "publicado" | "rejeitado";

export interface PostagemMarketing {
  id: string;
  empresa: string;
  titulo: string;
  descricao: string | null;
  dataPlanejada: string;
  dataPublicacao: string | null;
  linkDrive: string | null;
  status: StatusPostagem;
  feedbackGestor: string | null;
  criadoPor: string;
  createdAt: string;
}

function doBanco(linha: Record<string, unknown>): PostagemMarketing {
  return {
    id: linha.id as string,
    empresa: linha.empresa as string,
    titulo: linha.titulo as string,
    descricao: (linha.descricao as string) ?? null,
    dataPlanejada: linha.data_planejada as string,
    dataPublicacao: (linha.data_publicacao as string) ?? null,
    linkDrive: (linha.link_drive as string) ?? null,
    status: linha.status as StatusPostagem,
    feedbackGestor: (linha.feedback_gestor as string) ?? null,
    criadoPor: linha.criado_por as string,
    createdAt: linha.created_at as string,
  };
}

export async function listarPostagens(): Promise<PostagemMarketing[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("postagens_marketing")
    .select("*")
    .order("data_planejada", { ascending: true });

  if (error) {
    console.error("Erro ao carregar postagens:", error);
    return [];
  }
  return (data ?? []).map(doBanco);
}

export async function criarPostagem(dados: {
  empresa: string;
  titulo: string;
  descricao?: string;
  dataPlanejada: string;
  linkDrive?: string;
  status?: StatusPostagem;
}): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase.from("postagens_marketing").insert({
    empresa: dados.empresa,
    titulo: dados.titulo,
    descricao: dados.descricao ?? null,
    data_planejada: dados.dataPlanejada,
    link_drive: dados.linkDrive ?? null,
    status: dados.status ?? "planejado",
    criado_por: user.id,
  });

  if (error) {
    console.error("Erro ao criar postagem:", error);
    return false;
  }
  return true;
}

export async function atualizarPostagem(id: string, patch: Partial<PostagemMarketing>) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  const payload: Record<string, unknown> = {};
  if (patch.titulo !== undefined) payload.titulo = patch.titulo;
  if (patch.descricao !== undefined) payload.descricao = patch.descricao;
  if (patch.dataPlanejada !== undefined) payload.data_planejada = patch.dataPlanejada;
  if (patch.dataPublicacao !== undefined) payload.data_publicacao = patch.dataPublicacao;
  if (patch.linkDrive !== undefined) payload.link_drive = patch.linkDrive;
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.feedbackGestor !== undefined) payload.feedback_gestor = patch.feedbackGestor;

  const { error } = await supabase.from("postagens_marketing").update(payload).eq("id", id);
  if (error) {
    console.error("Erro ao atualizar postagem:", error);
    return false;
  }
  return true;
}

export async function apagarPostagem(id: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const { error } = await supabase.from("postagens_marketing").delete().eq("id", id);
  if (error) console.error("Erro ao apagar postagem:", error);
}
