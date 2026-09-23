import { NextRequest, NextResponse } from "next/server";
import { sessaoAura } from "@/lib/aura/sessao";
import { montarRelatorio, painelGestor } from "@/lib/aura/metricas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/aura/gestor[?loja=] — equipe, leads em risco e comparativo de lojas (30 dias). */
export async function GET(req: NextRequest) {
  const s = await sessaoAura({ diasAtividades: 31, diasVendas: 400 });
  if ("erro" in s) return NextResponse.json({ error: s.erro }, { status: s.status });
  if (!s.gestor) return NextResponse.json({ error: "Somente gestor ou diretor." }, { status: 403 });
  const loja = req.nextUrl.searchParams.get("loja") || undefined;
  const painel = painelGestor(s.dados, loja);
  const rel = montarRelatorio(s.dados, { loja }, 30);
  return NextResponse.json({ ...painel, porLoja: rel.porLoja, funil: rel.funil, vendasPorDia: rel.vendasPorDia, kpis: rel.kpis });
}
