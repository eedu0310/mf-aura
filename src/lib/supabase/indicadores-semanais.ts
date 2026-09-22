import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type Metrica =
  | "leads_loja"
  | "leads_mf"
  | "leads_marketing"
  | "faturamento_loja"
  | "faturamento_mf"
  | "faturamento_marketing"
  | "vendas_loja"
  | "vendas_mf"
  | "vendas_marketing";

export const METRICAS: { chave: Metrica; label: string; tipo: "Avg" | "Total"; formato: "numero" | "moeda" }[] = [
  { chave: "leads_loja", label: "Leads novos Recebidos Loja", tipo: "Avg", formato: "numero" },
  { chave: "leads_mf", label: "Leads novos Recebidos MF", tipo: "Avg", formato: "numero" },
  { chave: "leads_marketing", label: "Leads novos Rec. Marketing", tipo: "Avg", formato: "numero" },
  { chave: "faturamento_loja", label: "Faturamento Leads Recebidos Loja", tipo: "Total", formato: "moeda" },
  { chave: "vendas_loja", label: "Vendas Totais Leads Recebidos Loja", tipo: "Total", formato: "numero" },
  { chave: "faturamento_mf", label: "Faturamento de Leads Recebidos MF", tipo: "Total", formato: "moeda" },
  { chave: "vendas_mf", label: "Vendas Totais Leads Recebidos MF", tipo: "Total", formato: "numero" },
  { chave: "faturamento_marketing", label: "Faturamento Leads Rec. Marketing", tipo: "Total", formato: "moeda" },
  { chave: "vendas_marketing", label: "Vendas Totais Leads Rec. Marketing", tipo: "Total", formato: "numero" },
];

export const SEMANAS = [1, 2, 3, 4, 5] as const;
export const LABEL_SEMANA: Record<number, string> = {
  1: "Semana 1",
  2: "Semana 2",
  3: "Semana 3",
  4: "Semana 4",
  5: "Restante",
};

export interface IndicadorLinha {
  vendedorId: string;
  mes: string;
  semana: number;
  metrica: Metrica;
  valor: number;
}

function mesAtual() {
  return new Date().toISOString().slice(0, 7);
}

export async function listarIndicadoresDoMes(mes?: string, vendedorId?: string): Promise<IndicadorLinha[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  let query = supabase
    .from("indicadores_semanais")
    .select("vendedor_id, mes, semana, metrica, valor")
    .eq("mes", mes ?? mesAtual());

  if (vendedorId) query = query.eq("vendedor_id", vendedorId);

  const { data, error } = await query;
  if (error) {
    console.error("Erro ao carregar indicadores:", error);
    return [];
  }
  return (data ?? []).map((l) => ({
    vendedorId: l.vendedor_id as string,
    mes: l.mes as string,
    semana: Number(l.semana),
    metrica: l.metrica as Metrica,
    valor: Number(l.valor),
  }));
}

export async function salvarIndicador(
  empresa: string,
  mes: string,
  semana: number,
  metrica: Metrica,
  valor: number
): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase.from("indicadores_semanais").upsert(
    { vendedor_id: user.id, empresa, mes, semana, metrica, valor },
    { onConflict: "vendedor_id,mes,semana,metrica" }
  );

  if (error) {
    console.error("Erro ao salvar indicador:", error);
    return false;
  }
  return true;
}

export async function listarMetasIndicadoresDoMes(mes?: string, vendedorId?: string): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return mapa;

  let query = supabase
    .from("metas_indicadores")
    .select("vendedor_id, metrica, meta")
    .eq("mes", mes ?? mesAtual());
  if (vendedorId) query = query.eq("vendedor_id", vendedorId);

  const { data } = await query;
  for (const linha of data ?? []) {
    mapa.set(`${linha.vendedor_id}:${linha.metrica}`, Number(linha.meta));
  }
  return mapa;
}

export async function definirMetaIndicador(
  vendedorId: string,
  empresa: string,
  mes: string,
  metrica: Metrica,
  meta: number
): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("metas_indicadores")
    .upsert({ vendedor_id: vendedorId, empresa, mes, metrica, meta }, { onConflict: "vendedor_id,mes,metrica" });

  if (error) {
    console.error("Erro ao definir meta de indicador:", error);
    return false;
  }
  return true;
}
