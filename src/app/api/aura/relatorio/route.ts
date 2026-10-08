import { NextRequest, NextResponse } from "next/server";
import { sessaoAura } from "@/lib/aura/sessao";
import { montarRelatorio, moeda, type Insight } from "@/lib/aura/metricas";
import { gerarRecados } from "@/lib/aura/ia";
import { nucleoDoManual } from "@/lib/aura/trechos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/aura/relatorio?dias=30[&loja=][&vendedor=] — vendedor só vê o próprio. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const dias = Math.min(365, Math.max(7, Number(sp.get("dias")) || 30));
  const s = await sessaoAura({ diasAtividades: dias + 1, diasVendas: dias + 1 });
  if ("erro" in s) return NextResponse.json({ error: s.erro }, { status: s.status });
  const { dados, userId, gestor } = s;

  const escopo = gestor
    ? { loja: sp.get("loja") || undefined, vendedorId: sp.get("vendedor") || undefined }
    : { vendedorId: userId };
  const rel = montarRelatorio(dados, escopo, dias);

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
  });

  return NextResponse.json({
    relatorio: rel,
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
