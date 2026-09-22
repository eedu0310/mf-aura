import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type StatusConversa = "aguardando_aceite" | "em_atendimento" | "encerrada";
export type Remetente = "cliente" | "atendente" | "ia";

export interface ConversaWhatsapp {
  id: string;
  empresa: string;
  leadId: string | null;
  telefone: string;
  nomeCliente: string | null;
  atendenteId: string | null;
  status: StatusConversa;
  iaAtiva: boolean;
  ultimaMensagemEm: string;
  ultimaMensagemPreview: string | null;
  createdAt: string;
}

export interface MensagemWhatsapp {
  id: string;
  conversaId: string;
  remetente: Remetente;
  texto: string;
  createdAt: string;
}

function conversaDoBanco(l: Record<string, unknown>): ConversaWhatsapp {
  return {
    id: l.id as string,
    empresa: l.empresa as string,
    leadId: (l.lead_id as string) ?? null,
    telefone: l.telefone as string,
    nomeCliente: (l.nome_cliente as string) ?? null,
    atendenteId: (l.atendente_id as string) ?? null,
    status: l.status as StatusConversa,
    iaAtiva: Boolean(l.ia_ativa),
    ultimaMensagemEm: l.ultima_mensagem_em as string,
    ultimaMensagemPreview: (l.ultima_mensagem_preview as string) ?? null,
    createdAt: l.created_at as string,
  };
}

function mensagemDoBanco(l: Record<string, unknown>): MensagemWhatsapp {
  return {
    id: l.id as string,
    conversaId: l.conversa_id as string,
    remetente: l.remetente as Remetente,
    texto: l.texto as string,
    createdAt: l.created_at as string,
  };
}

export async function listarConversas(): Promise<ConversaWhatsapp[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("whatsapp_conversas")
    .select("*")
    .neq("status", "encerrada")
    .order("ultima_mensagem_em", { ascending: false });

  if (error) {
    console.error("Erro ao carregar conversas:", error);
    return [];
  }
  return (data ?? []).map(conversaDoBanco);
}

export async function listarMensagens(conversaId: string): Promise<MensagemWhatsapp[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("whatsapp_mensagens")
    .select("*")
    .eq("conversa_id", conversaId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erro ao carregar mensagens:", error);
    return [];
  }
  return (data ?? []).map(mensagemDoBanco);
}

export async function aceitarConversa(conversaId: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from("whatsapp_conversas")
    .update({ atendente_id: user.id, status: "em_atendimento", ia_ativa: false })
    .eq("id", conversaId)
    .is("atendente_id", null);

  if (error) {
    console.error("Erro ao aceitar conversa:", error);
    return false;
  }
  return true;
}

export async function encerrarConversa(conversaId: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("whatsapp_conversas")
    .update({ status: "encerrada" })
    .eq("id", conversaId);

  if (error) {
    console.error("Erro ao encerrar conversa:", error);
    return false;
  }
  return true;
}

export async function enviarMensagemConversa(conversaId: string, texto: string): Promise<boolean> {
  try {
    const resp = await fetch("/api/whatsapp/enviar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversaId, texto }),
    });
    const dados = await resp.json();
    if (!resp.ok) {
      console.error("Erro ao enviar mensagem:", dados.erro);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro ao enviar mensagem:", err);
    return false;
  }
}
