import type { SupabaseClient } from "@supabase/supabase-js";
import { todasAsLinhas } from "@/lib/supabase/todas-as-linhas";
import type { PosVendaResumo } from "./relatorio-detalhado";

/**
 * Notas e reclamações do pós-venda desde uma data, para a satisfação dos
 * relatórios (Indicadores do período e Relatório semanal). Lê com o cliente
 * que vier — o do usuário respeita as regras de loja do banco. Se falhar, o
 * relatório sai sem a satisfação em vez de não sair.
 */
export async function carregarPosVendaResumo(sb: SupabaseClient, desdeIso: string): Promise<PosVendaResumo[]> {
  try {
    const linhas = await todasAsLinhas<{
      vendedor_id: string | null;
      empresa: string | null;
      avaliacao_nota: number | null;
      nota_avaliacao: number | null;
      possui_reclamacao: boolean | null;
      reclamacao: string | null;
      reclamacao_aberta_em: string | null;
      created_at: string;
    }>((de, ate) =>
      sb
        .from("pos_vendas")
        .select("vendedor_id, empresa, avaliacao_nota, nota_avaliacao, possui_reclamacao, reclamacao, reclamacao_aberta_em, created_at")
        .or(`created_at.gte.${desdeIso},reclamacao_aberta_em.gte.${desdeIso}`)
        .order("id")
        .range(de, ate),
    );
    return linhas.map((p) => ({
      vendedor_id: p.vendedor_id,
      empresa: p.empresa,
      nota: p.nota_avaliacao ?? p.avaliacao_nota ?? null,
      reclamacao: !!p.possui_reclamacao || !!(p.reclamacao && p.reclamacao.trim()),
      criado_em: p.created_at,
      reclamacao_em: p.reclamacao_aberta_em,
    }));
  } catch (e) {
    console.error("[relatorio] pós-venda:", e instanceof Error ? e.message : e);
    return [];
  }
}
