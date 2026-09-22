import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type TipoRelatorio = "semanal_vendedor" | "semanal_gestor" | "mensal_diretor";

export interface RelatorioPeriodico {
  id: string;
  empresa: string;
  vendedorId: string | null;
  tipo: TipoRelatorio;
  periodoInicio: string;
  periodoFim: string;
  conteudo: string;
  createdAt: string;
}

function doBanco(linha: Record<string, unknown>): RelatorioPeriodico {
  return {
    id: linha.id as string,
    empresa: linha.empresa as string,
    vendedorId: (linha.vendedor_id as string) ?? null,
    tipo: linha.tipo as TipoRelatorio,
    periodoInicio: linha.periodo_inicio as string,
    periodoFim: linha.periodo_fim as string,
    conteudo: linha.conteudo as string,
    createdAt: linha.created_at as string,
  };
}

export async function listarRelatorios(tipo?: TipoRelatorio): Promise<RelatorioPeriodico[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  let query = supabase.from("relatorios_periodicos").select("*").order("created_at", { ascending: false }).limit(30);
  if (tipo) query = query.eq("tipo", tipo);

  const { data, error } = await query;
  if (error) {
    console.error("Erro ao carregar relatórios:", error);
    return [];
  }
  return (data ?? []).map(doBanco);
}
