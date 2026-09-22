import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type StatusLead = "aguardando_sdr" | "atribuido_sdr" | "respondido" | "repassado_vendedor" | "perdido";

export interface Lead {
  id: string;
  nome: string | null;
  telefone: string;
  empresa: string;
  mensagemInicial: string | null;
  origem: string;
  status: StatusLead;
  sdrId: string | null;
  vendedorId: string | null;
  prazoResposta: string | null;
  respondidoEm: string | null;
  createdAt: string;
  classificacao: "qualificado" | "duvida" | "spam" | null;
  urgencia: "baixa" | "media" | "alta" | null;
  resumoIa: string | null;
  gestorNotificado: boolean;
  motivoPerda: string | null;
  relacionamentoId: string | null;
  respostasQualificacao: { pergunta: string; resposta: string }[];
  qualificacaoConcluida: boolean;
}

function doBanco(linha: Record<string, unknown>): Lead {
  return {
    id: linha.id as string,
    nome: (linha.nome as string) ?? null,
    telefone: linha.telefone as string,
    empresa: linha.empresa as string,
    mensagemInicial: (linha.mensagem_inicial as string) ?? null,
    origem: linha.origem as string,
    status: linha.status as StatusLead,
    sdrId: (linha.sdr_id as string) ?? null,
    vendedorId: (linha.vendedor_id as string) ?? null,
    prazoResposta: (linha.prazo_resposta as string) ?? null,
    respondidoEm: (linha.respondido_em as string) ?? null,
    createdAt: linha.created_at as string,
    classificacao: (linha.classificacao as Lead["classificacao"]) ?? null,
    urgencia: (linha.urgencia as Lead["urgencia"]) ?? null,
    resumoIa: (linha.resumo_ia as string) ?? null,
    gestorNotificado: Boolean(linha.gestor_notificado),
    motivoPerda: (linha.motivo_perda as string) ?? null,
    relacionamentoId: (linha.relacionamento_id as string) ?? null,
    respostasQualificacao: Array.isArray(linha.respostas_qualificacao)
      ? (linha.respostas_qualificacao as { pergunta: string; resposta: string }[])
      : [],
    qualificacaoConcluida: Boolean(linha.qualificacao_concluida),
  };
}

export async function listarLeads(): Promise<Lead[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("leads_recebidos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar leads:", error);
    return [];
  }
  return (data ?? []).map(doBanco);
}

export async function marcarLeadRespondido(id: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("leads_recebidos")
    .update({
      status: "respondido",
      respondido_em: new Date().toISOString(),
      respondido_por: user?.id ?? null,
    })
    .eq("id", id);

  if (error) console.error("Erro ao marcar lead como respondido:", error);
}

export async function marcarLeadPerdido(id: string, motivo: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const { error } = await supabase
    .from("leads_recebidos")
    .update({ status: "perdido", motivo_perda: motivo || null })
    .eq("id", id);

  if (error) console.error("Erro ao marcar lead como perdido:", error);
}

export async function excluirLead(id: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("leads_recebidos")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) {
    console.error("Erro ao excluir lead:", error);
    throw error;
  }
  if (!data || data.length === 0) throw new Error("Lead não excluído. Verifique as permissões RLS.");
  return true;
}

/**
 * Pra cada relacionamento_id informado, retorna há quantos dias foi a
 * última atividade registrada — usado pra alertar "cliente sem contato
 * há X dias" na fila de leads.
 */
export async function buscarDiasSemAtividade(
  relacionamentoIds: string[]
): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  const supabase = getSupabaseBrowserClient();
  if (!supabase || relacionamentoIds.length === 0) return mapa;

  const { data } = await supabase
    .from("atividades")
    .select("relacionamento_id, created_at")
    .in("relacionamento_id", relacionamentoIds)
    .order("created_at", { ascending: false });

  for (const linha of data ?? []) {
    const id = linha.relacionamento_id as string;
    if (mapa.has(id)) continue; // já pegamos a mais recente (ordenado desc)
    const dias = Math.floor((Date.now() - new Date(linha.created_at as string).getTime()) / 86_400_000);
    mapa.set(id, dias);
  }
  return mapa;
}
export interface LeadEscalonado extends Lead {
  vendedorNome: string;
}

export async function listarLeadsEscalonados(): Promise<LeadEscalonado[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  const { data: leadsData, error } = await supabase
    .from("leads_recebidos")
    .select("*")
    .eq("gestor_notificado", true)
    .eq("status", "repassado_vendedor")
    .order("prazo_resposta", { ascending: true });

  if (error || !leadsData || leadsData.length === 0) return [];

  const vendedorIds = [...new Set(leadsData.map((l) => l.vendedor_id).filter(Boolean))];
  const { data: perfis } = await supabase.from("profiles").select("id, nome").in("id", vendedorIds);
  const mapaNomes = new Map((perfis ?? []).map((p) => [p.id, p.nome]));

  return leadsData.map((linha) => ({
    ...doBanco(linha),
    vendedorNome: mapaNomes.get(linha.vendedor_id as string) ?? "Vendedor",
  }));
}

export async function buscarConfigDistribuicao(): Promise<number | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("config_distribuicao_leads")
    .select("tempo_resposta_sdr_minutos")
    .maybeSingle();

  return data ? Number(data.tempo_resposta_sdr_minutos) : null;
}

export async function definirConfigDistribuicao(empresa: string, minutos: number) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("config_distribuicao_leads")
    .upsert({ empresa, tempo_resposta_sdr_minutos: minutos, updated_at: new Date().toISOString() });

  if (error) {
    console.error("Erro ao salvar configuração de distribuição:", error);
    return false;
  }
  return true;
}
