import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type StatusLead =
  | "aguardando_sdr"
  | "atribuido_sdr"
  | "respondido"
  | "repassado_vendedor"
  | "perdido"
  /** Curioso / frio: sai da fila e vira card na coluna "Leads frios" (migração 102). */
  | "lead_frio";

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

/**
 * Filtro dos leads de verdade: quem o vendedor marcou no WhatsApp como
 * cliente antigo ou como não-lead sai da fila (natureza preenchida). Sem isto
 * o cliente que comprou há um ano aparecia como "lead sem resposta".
 */
export const SO_LEADS_DE_VERDADE = "natureza.is.null,natureza.eq.lead";

export async function listarLeads(): Promise<Lead[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("leads_recebidos")
    .select("*")
    .or(SO_LEADS_DE_VERDADE)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar leads:", error);
    return [];
  }
  return (data ?? []).map(doBanco);
}

/** true = gravou. Antes engolia o erro e a tela mostrava a mudança sem nada salvo. */
export async function marcarLeadRespondido(id: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("leads_recebidos")
    .update({
      status: "respondido",
      respondido_em: new Date().toISOString(),
      respondido_por: user?.id ?? null,
    })
    .eq("id", id)
    .select("id");

  if (error) console.error("Erro ao marcar lead como respondido:", error);
  return !error && (data?.length ?? 0) > 0;
}

/**
 * Lead frio / curioso: não é para descartar, mas também não está pronto. Sai
 * da fila e o banco (gatilho da migração 102) cria ou move o card para a
 * coluna "Leads frios" e marca o cliente como frio. Conta como atendido no
 * relatório: a vendedora olhou e decidiu.
 */
export async function marcarLeadFrio(id: string, jaRespondidoEm?: string | null): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const patch: Record<string, unknown> = { status: "lead_frio" };
  if (!jaRespondidoEm) {
    patch.respondido_em = new Date().toISOString();
    patch.respondido_por = user?.id ?? null;
  }
  const { error } = await supabase.from("leads_recebidos").update(patch).eq("id", id);
  if (error) {
    console.error("Erro ao marcar lead como frio:", error);
    return false;
  }
  return true;
}

/** true = gravou (idem marcarLeadRespondido). */
export async function marcarLeadPerdido(id: string, motivo: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from("leads_recebidos")
    .update({ status: "perdido", motivo_perda: motivo || null })
    .eq("id", id)
    .select("id");

  if (error) console.error("Erro ao marcar lead como perdido:", error);
  return !error && (data?.length ?? 0) > 0;
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
    .or(SO_LEADS_DE_VERDADE)
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

/** Nome de cada vendedor/SDR pelo id, para filtros e relatórios. */
export async function buscarNomesDosVendedores(ids: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const supabase = getSupabaseBrowserClient();
  const unicos = [...new Set(ids.filter(Boolean))];
  if (!supabase || unicos.length === 0) return mapa;
  const { data, error } = await supabase.from("profiles").select("id, nome").in("id", unicos);
  if (error) console.error("Erro ao buscar nomes dos vendedores:", error);
  for (const p of data ?? []) mapa.set(p.id as string, String(p.nome ?? "").trim() || "Vendedor sem nome");
  return mapa;
}

/**
 * Atividades registradas com os clientes dos leads, da mais antiga para a
 * mais nova, para saber quando cada lead foi atendido. Ficam de fora as que a
 * IA cria sozinha ao abrir a oportunidade (origem whatsapp_ia): não são
 * atendimento de ninguém. Busca em blocos para não estourar o tamanho do
 * endereço nem o limite de 1000 linhas por consulta.
 */
export async function buscarAtividadesDosLeads(
  relacionamentoIds: string[],
): Promise<Map<string, { em: number; tipo: string; origem: string | null }[]>> {
  const mapa = new Map<string, { em: number; tipo: string; origem: string | null }[]>();
  const supabase = getSupabaseBrowserClient();
  const unicos = [...new Set(relacionamentoIds.filter(Boolean))];
  if (!supabase || unicos.length === 0) return mapa;

  const BLOCO = 40;
  const blocos: string[][] = [];
  for (let i = 0; i < unicos.length; i += BLOCO) blocos.push(unicos.slice(i, i + BLOCO));

  const respostas = await Promise.all(
    blocos.map((ids) =>
      supabase
        .from("atividades")
        .select("relacionamento_id, created_at, tipo, origem")
        .in("relacionamento_id", ids)
        .or("origem.is.null,origem.neq.whatsapp_ia")
        .order("created_at", { ascending: true })
        .limit(1000),
    ),
  );
  for (const { data, error } of respostas) {
    if (error) {
      console.error("Erro ao buscar atividades dos leads:", error);
      continue;
    }
    for (const linha of data ?? []) {
      const id = linha.relacionamento_id as string;
      const item = {
        em: new Date(linha.created_at as string).getTime(),
        tipo: String(linha.tipo ?? ""),
        origem: (linha.origem as string) ?? null,
      };
      const lista = mapa.get(id);
      if (lista) lista.push(item);
      else mapa.set(id, [item]);
    }
  }
  for (const lista of mapa.values()) lista.sort((a, b) => a.em - b.em);
  return mapa;
}
