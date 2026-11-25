import { NextRequest, NextResponse } from "next/server";
import { sessaoAura } from "@/lib/aura/sessao";
import { montarRelatorioDetalhadoJanela } from "@/lib/aura/relatorio-detalhado";
import { carregarPosVendaResumo } from "@/lib/aura/pos-venda-resumo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIA = 86400e3;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/relatorios/indicadores?inicio=AAAA-MM-DD&fim=AAAA-MM-DD[&loja=]
 *
 * Os 10 indicadores do time de vendas (receita, prospecções, conversão,
 * ticket, margem, ciclo, cancelamentos, meta, satisfação) para a janela do
 * Relatório semanal, e os mesmos números da janela anterior de mesmo tamanho,
 * para o relatório mostrar se subiu ou caiu.
 *
 * Gestor: a loja pedida (as regras do banco já prendem o gestor de loja na
 * dele). Vendedor: só os próprios números, qualquer que seja a loja pedida.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const inicioTxt = sp.get("inicio") ?? "";
  const fimTxt = sp.get("fim") ?? "";
  if (!DATA.test(inicioTxt) || !DATA.test(fimTxt)) {
    return NextResponse.json({ erro: "Informe inicio e fim no formato AAAA-MM-DD." }, { status: 400 });
  }
  const inicio = Date.parse(`${inicioTxt}T00:00:00-03:00`);
  const fim = Date.parse(`${fimTxt}T23:59:59-03:00`);
  if (!(fim >= inicio) || fim - inicio > 93 * DIA) {
    return NextResponse.json({ erro: "Período inválido (até 3 meses)." }, { status: 400 });
  }
  const tamanho = fim - inicio + 1000;
  const inicioAnterior = inicio - tamanho;
  const fimAnterior = inicio - 1000;

  // Dados desde o começo da janela anterior (e o mês inteiro, para a meta).
  const diasAtras = Math.ceil((Date.now() - inicioAnterior) / DIA) + 2;
  const s = await sessaoAura({ diasAtividades: diasAtras, diasVendas: Math.max(diasAtras, 62) });
  if ("erro" in s) return NextResponse.json({ erro: s.erro }, { status: s.status });
  const { dados, userId, gestor } = s;

  const escopo = gestor ? { loja: sp.get("loja") || undefined } : { vendedorId: userId };
  const posVendas = await carregarPosVendaResumo(s.sb, new Date(inicioAnterior).toISOString());

  const atual = montarRelatorioDetalhadoJanela(dados, escopo, inicio, fim, posVendas);
  const anterior = montarRelatorioDetalhadoJanela(dados, escopo, inicioAnterior, fimAnterior, posVendas);

  return NextResponse.json({
    atual,
    anterior: {
      geral: anterior.geral,
      porVendedor: anterior.porVendedor.map((v) => ({ id: v.id, receita: v.receita, prospeccoes: v.prospeccoes, conversao: v.conversao })),
    },
    gestor,
  });
}
