import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type StatusCampanha = "planejada" | "ativa" | "pausada" | "encerrada";

export interface Campanha {
  id: string;
  empresa: string;
  nome: string;
  canal: string;
  status: StatusCampanha;
  dataInicio: string | null;
  dataFim: string | null;
  orcamento: number | null;
  leadsGerados: number;
  observacoes: string | null;
  createdAt: string;
}

function doBanco(linha: Record<string, unknown>): Campanha {
  return {
    id: linha.id as string,
    empresa: linha.empresa as string,
    nome: linha.nome as string,
    canal: linha.canal as string,
    status: linha.status as StatusCampanha,
    dataInicio: (linha.data_inicio as string) ?? null,
    dataFim: (linha.data_fim as string) ?? null,
    orcamento: linha.orcamento !== null ? Number(linha.orcamento) : null,
    leadsGerados: Number(linha.leads_gerados ?? 0),
    observacoes: (linha.observacoes as string) ?? null,
    createdAt: linha.created_at as string,
  };
}

export async function listarCampanhas(): Promise<Campanha[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("campanhas_marketing")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar campanhas:", error);
    return [];
  }
  return (data ?? []).map(doBanco);
}

export async function criarCampanha(dados: {
  empresa: string;
  nome: string;
  canal: string;
  dataInicio?: string;
  dataFim?: string;
  orcamento?: number;
  observacoes?: string;
}): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase.from("campanhas_marketing").insert({
    empresa: dados.empresa,
    nome: dados.nome,
    canal: dados.canal,
    data_inicio: dados.dataInicio || null,
    data_fim: dados.dataFim || null,
    orcamento: dados.orcamento ?? null,
    observacoes: dados.observacoes || null,
    criado_por: user.id,
  });

  if (error) {
    console.error("Erro ao criar campanha:", error);
    return false;
  }
  return true;
}

export async function atualizarCampanha(id: string, patch: Partial<Campanha>): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  const payload: Record<string, unknown> = {};
  if (patch.nome !== undefined) payload.nome = patch.nome;
  if (patch.canal !== undefined) payload.canal = patch.canal;
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.dataInicio !== undefined) payload.data_inicio = patch.dataInicio;
  if (patch.dataFim !== undefined) payload.data_fim = patch.dataFim;
  if (patch.orcamento !== undefined) payload.orcamento = patch.orcamento;
  if (patch.leadsGerados !== undefined) payload.leads_gerados = patch.leadsGerados;
  if (patch.observacoes !== undefined) payload.observacoes = patch.observacoes;

  const { error } = await supabase.from("campanhas_marketing").update(payload).eq("id", id);
  if (error) {
    console.error("Erro ao atualizar campanha:", error);
    return false;
  }
  return true;
}

export async function apagarCampanha(id: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const { error } = await supabase.from("campanhas_marketing").delete().eq("id", id);
  if (error) console.error("Erro ao apagar campanha:", error);
}
