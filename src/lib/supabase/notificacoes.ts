import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type TipoNotificacao = 
  | "compromisso" 
  | "lead_frio" 
  | "tarefa_urgente" 
  | "saudacao"
  | "venda"
  | "meta_atingida"
  | "alerta";

export interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: TipoNotificacao;
  lida: boolean;
  acaoUrl?: string;
  criadaEm: string;
  lidaEm?: string;
}

export async function criarNotificacao(
  vendedorId: string,
  titulo: string,
  mensagem: string,
  tipo: TipoNotificacao,
  acaoUrl?: string
): Promise<Notificacao | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("notificacoes")
      .insert([
        {
          vendedor_id: vendedorId,
          titulo,
          mensagem,
          tipo,
          acao_url: acaoUrl,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Erro ao criar notificação:", error);
      return null;
    }

    return data
      ? {
          id: data.id,
          titulo: data.titulo,
          mensagem: data.mensagem,
          tipo: data.tipo,
          lida: data.lida,
          acaoUrl: data.acao_url,
          criadaEm: data.criada_em,
          lidaEm: data.lida_em,
        }
      : null;
  } catch (erro) {
    console.error("Erro ao criar notificação:", erro);
    return null;
  }
}

export async function listarNotificacoes(): Promise<Notificacao[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("notificacoes")
      .select("*")
      .eq("vendedor_id", user.id)
      .order("criada_em", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Erro ao listar notificações:", error);
      return [];
    }

    return data
      ? data.map((n: any) => ({
          id: n.id,
          titulo: n.titulo,
          mensagem: n.mensagem,
          tipo: n.tipo,
          lida: n.lida,
          acaoUrl: n.acao_url,
          criadaEm: n.criada_em,
          lidaEm: n.lida_em,
        }))
      : [];
  } catch (erro) {
    console.error("Erro ao listar notificações:", erro);
    return [];
  }
}

export async function marcarComoLida(notificacaoId: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from("notificacoes")
      .update({
        lida: true,
        lida_em: new Date().toISOString(),
      })
      .eq("id", notificacaoId);

    if (error) {
      console.error("Erro ao marcar como lida:", error);
      return false;
    }

    return true;
  } catch (erro) {
    console.error("Erro ao marcar como lida:", erro);
    return false;
  }
}

export async function deletarNotificacao(notificacaoId: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from("notificacoes")
      .delete()
      .eq("id", notificacaoId);

    if (error) {
      console.error("Erro ao deletar notificação:", error);
      return false;
    }

    return true;
  } catch (erro) {
    console.error("Erro ao deletar notificação:", erro);
    return false;
  }
}

export async function limparNotificacoes(): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from("notificacoes")
      .delete()
      .eq("vendedor_id", user.id)
      .eq("lida", true);

    if (error) {
      console.error("Erro ao limpar notificações:", error);
      return false;
    }

    return true;
  } catch (erro) {
    console.error("Erro ao limpar notificações:", erro);
    return false;
  }
}