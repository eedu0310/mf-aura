import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type CategoriaMeta =
  | "Cliente Final"
  | "Arquiteto"
  | "Construtora"
  | "Obra"
  | "Revendedor"
  | "Engenheiro"
  | "Designer de Interiores";

export type PeriodoMeta = "semanal" | "mensal";

export interface MetaAtividade {
  id: string;
  vendedorId: string;
  categoria: CategoriaMeta;
  periodo: PeriodoMeta;
  quantidade: number;
}

function doBanco(linha: Record<string, unknown>): MetaAtividade {
  return {
    id: linha.id as string,
    vendedorId: linha.vendedor_id as string,
    categoria: linha.categoria as CategoriaMeta,
    periodo: linha.periodo as PeriodoMeta,
    quantidade: Number(linha.quantidade),
  };
}

/** Gestor: todas as metas de atividade de todos os vendedores de uma vez. */
export async function listarMetasAtividade(): Promise<MetaAtividade[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  const { data, error } = await supabase.from("metas_atividade").select("*");
  if (error) {
    console.error("Erro ao carregar metas de atividade:", error);
    return [];
  }
  return (data ?? []).map(doBanco);
}

export async function definirMetaAtividade(
  vendedorId: string,
  empresa: string,
  categoria: CategoriaMeta,
  periodo: PeriodoMeta,
  quantidade: number
): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("metas_atividade")
    .upsert(
      { vendedor_id: vendedorId, empresa, categoria, periodo, quantidade },
      { onConflict: "vendedor_id,categoria,periodo" }
    );

  if (error) {
    console.error("Erro ao definir meta de atividade:", error);
    return false;
  }
  return true;
}

/** Conta quantas atividades de "visita" o vendedor registrou, por
 *  categoria do relacionamento, desde uma data. Usado pra comparar
 *  com a meta definida pelo Gestor. */
export async function contarVisitasPorCategoria(
  vendedorId: string,
  desdeISO: string
): Promise<Record<string, number>> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return {};

  const { data, error } = await supabase
    .from("atividades")
    .select("relacionamento_id, created_at")
    .eq("owner_id", vendedorId)
    .gte("created_at", desdeISO)
    .not("relacionamento_id", "is", null);

  if (error || !data || data.length === 0) return {};

  const relIds = [...new Set(data.map((a) => a.relacionamento_id as string))];
  const { data: relacionamentos } = await supabase
    .from("relacionamentos")
    .select("id, categoria")
    .in("id", relIds);

  const categoriaPorRelId = new Map((relacionamentos ?? []).map((r) => [r.id, r.categoria as string]));
  const contagem: Record<string, number> = {};
  for (const a of data) {
    const cat = categoriaPorRelId.get(a.relacionamento_id as string);
    if (!cat) continue;
    contagem[cat] = (contagem[cat] ?? 0) + 1;
  }
  return contagem;
}
