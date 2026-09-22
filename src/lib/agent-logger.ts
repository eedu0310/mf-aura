import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Supabase credentials not configured");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface AcaoAgente {
  id?: string;
  user_id: string;
  empresa_id: string;
  tipo_acao: string;
  parametros: Record<string, unknown>;
  resultado?: Record<string, unknown> | null;
  sucesso: boolean;
  erro?: string | null;
  criado_por?: string;
  criado_em?: string;
}

/**
 * Registra uma ação executada pelo agente autônomo
 */
export async function logarAcao(acao: AcaoAgente): Promise<void> {
  try {
    const { error } = await supabase
      .from("aura_agent_logs")
      .insert([
        {
          user_id: acao.user_id,
          empresa_id: acao.empresa_id,
          tipo_acao: acao.tipo_acao,
          parametros: acao.parametros,
          resultado: acao.resultado || null,
          sucesso: acao.sucesso,
          erro: acao.erro || null,
          criado_por: acao.criado_por || "autonomous_agent",
        },
      ]);

    if (error) {
      console.error("Erro ao registrar log de ação:", error);
    }
  } catch (err) {
    console.error("Erro ao logarAcao:", err);
  }
}

/**
 * Obtém histórico de ações do agente com filtros
 */
export async function obterHistoricoAgente(
  userId: string,
  empresaId: string,
  filtros?: {
    tipoAcao?: string;
    dataInicio?: string;
    dataFim?: string;
    apenaSucessos?: boolean;
  }
): Promise<AcaoAgente[]> {
  try {
    let query = supabase
      .from("aura_agent_logs")
      .select("*")
      .eq("user_id", userId)
      .eq("empresa_id", empresaId)
      .order("criado_em", { ascending: false })
      .limit(100);

    if (filtros?.tipoAcao) {
      query = query.eq("tipo_acao", filtros.tipoAcao);
    }

    if (filtros?.apenaSucessos) {
      query = query.eq("sucesso", true);
    }

    if (filtros?.dataInicio) {
      query = query.gte("criado_em", filtros.dataInicio);
    }

    if (filtros?.dataFim) {
      query = query.lte("criado_em", filtros.dataFim);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Erro ao buscar histórico do agente:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Erro ao obterHistoricoAgente:", err);
    return [];
  }
}

/**
 * Obtém estatísticas de execução do agente
 */
export async function obterEstatisticasAgente(
  userId: string,
  empresaId: string
): Promise<{
  totalAcoes: number;
  sucessos: number;
  erros: number;
  taxaSucesso: number;
  acoesPorTipo: Record<string, number>;
}> {
  try {
    const acoes = await obterHistoricoAgente(userId, empresaId);

    const sucessos = acoes.filter((a) => a.sucesso).length;
    const erros = acoes.filter((a) => !a.sucesso).length;

    const acoesPorTipo: Record<string, number> = {};
    acoes.forEach((a) => {
      acoesPorTipo[a.tipo_acao] = (acoesPorTipo[a.tipo_acao] || 0) + 1;
    });

    return {
      totalAcoes: acoes.length,
      sucessos,
      erros,
      taxaSucesso: acoes.length > 0 ? (sucessos / acoes.length) * 100 : 0,
      acoesPorTipo,
    };
  } catch (err) {
    console.error("Erro ao obterEstatisticasAgente:", err);
    return {
      totalAcoes: 0,
      sucessos: 0,
      erros: 0,
      taxaSucesso: 0,
      acoesPorTipo: {},
    };
  }
}
