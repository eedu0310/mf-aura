import { NextRequest, NextResponse } from "next/server";
import { sessaoAura } from "@/lib/aura/sessao";
import { montarRelatorio, moeda, type Insight } from "@/lib/aura/metricas";
import { gerarRecados } from "@/lib/aura/ia";
import { nucleoDoManual } from "@/lib/aura/trechos";
import { montarRelatorioDetalhado, type PosVendaResumo } from "@/lib/aura/relatorio-detalhado";
import { todasAsLinhas } from "@/lib/supabase/todas-as-linhas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/aura/relatorio?dias=30[&loja=][&vendedor=] — vendedor só vê o próprio. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const dias = Math.min(365, Math.max(7, Number(sp.get("dias")) || 30));
  // Vendas de pelo menos um mês inteiro: o atingimento da meta é do mês
  // corrente, mesmo quando o período escolhido é de 7 dias.
  const s = await sessaoAura({ diasAtividades: dias + 1, diasVendas: Math.max(dias + 1, 32) });
  if ("erro" in s) return NextResponse.json({ error: s.erro }, { status: s.status });
  const { dados, userId, gestor } = s;

  const escopo = gestor
    ? { loja: sp.get("loja") || undefined, vendedorId: sp.get("vendedor") || undefined }
    : { vendedorId: userId };
  const rel = montarRelatorio(dados, escopo, dias);

  // Satisfação: notas e reclamações do pós-venda, com as regras de loja do
  // banco (o cliente é o do usuário). Se a leitura falhar, o relatório sai
  // sem a satisfação em vez de não sair.
  const desde = new Date(Date.now() - (dias + 1) * 86400e3).toISOString();
  let posVendas: PosVendaResumo[] = [];
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
      s.sb
        .from("pos_vendas")
        .select("vendedor_id, empresa, avaliacao_nota, nota_avaliacao, possui_reclamacao, reclamacao, reclamacao_aberta_em, created_at")
        .or(`created_at.gte.${desde},reclamacao_aberta_em.gte.${desde}`)
        .order("id")
        .range(de, ate),
    );
    posVendas = linhas.map((p) => ({
      vendedor_id: p.vendedor_id,
      empresa: p.empresa,
      nota: p.avaliacao_nota ?? p.nota_avaliacao ?? null,
      reclamacao: !!p.possui_reclamacao || !!(p.reclamacao && p.reclamacao.trim()),
      criado_em: p.created_at,
      reclamacao_em: p.reclamacao_aberta_em,
    }));
  } catch (e) {
    console.error("[relatorio] pós-venda:", e instanceof Error ? e.message : e);
  }
  const detalhado = montarRelatorioDetalhado(dados, escopo, dias, posVendas);

  const base: Insight[] = [
    { tipo: "conquista", titulo: `${moeda(rel.kpis.vendido)} vendidos em ${dias} dias`, detalhe: `${rel.kpis.qtdVendas} venda(s), ticket de ${moeda(rel.kpis.ticket)}.` },
    { tipo: "dica", titulo: `${rel.kpis.atividades} atividades no período`, detalhe: rel.atividadesPorTipo[0] ? `Mais feita: ${rel.atividadesPorTipo[0].tipo}.` : undefined },
  ];
  const aura = await gerarRecados({
    cacheKey: `${userId}|relatorio|${dias}|${escopo.loja ?? "*"}|${escopo.vendedorId ?? "*"}`,
    pagina: "relatorio",
    pessoa: { nome: dados.perfil.nome, cargo: dados.perfil.cargo, loja: dados.perfil.empresa },
    metricas: { ...rel, vendasPorDia: undefined, atividadesPorDia: undefined },
    recadosBase: base,
    materiais: await nucleoDoManual(s.sb, dados.perfil.empresa),
    forcar: sp.has("refresh"),
    usuarioId: userId,
  });

  return NextResponse.json({
    relatorio: rel,
    detalhado,
    aura,
    gestor,
    filtros: gestor
      ? {
          lojas: [...new Set(dados.perfis.map((p) => p.empresa))].filter(Boolean).sort(),
          vendedores: dados.perfis
            .filter((p) => /vendedor/i.test(p.cargo ?? ""))
            .map((p) => ({ id: p.id, nome: p.nome, loja: p.empresa })),
        }
      : null,
  });
}
