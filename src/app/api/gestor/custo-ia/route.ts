import { NextResponse } from "next/server";
import { getEmpresaAutenticada, mandaNaLoja } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { saldoIA, totaisIA } from "@/lib/aura/custo-ia";
import { todasAsLinhas } from "@/lib/supabase/todas-as-linhas";
import { diaEmSaoPaulo } from "@/lib/fuso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function somenteGestor() {
  const auth = await getEmpresaAutenticada();
  if (!auth) return { erro: NextResponse.json({ erro: "Não autenticado." }, { status: 401 }) };
  if (!mandaNaLoja(auth)) {
    return { erro: NextResponse.json({ erro: "Somente o gestor pode ver isso." }, { status: 403 }) };
  }
  return { auth };
}

/** Painel de custo da IA: saldo, consumo e para onde o dinheiro foi. */
export async function GET() {
  const { erro, auth } = await somenteGestor();
  if (erro) return erro;

  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 });

  const agora = new Date();
  const trintaDias = new Date(agora.getTime() - 30 * 86400_000).toISOString();

  /**
   * Hoje e mês vêm somados do banco, no dia de Brasília (totaisIA).
   *
   * Antes as duas somas eram feitas em cima da lista dos últimos 30 dias — que
   * o Supabase corta em 1000 linhas sem avisar, e o sistema faz bem mais de
   * mil chamadas por mês. E "hoje" começava à meia-noite do RELÓGIO DO
   * SERVIDOR, não de Brasília. A lista agora é lida inteira, página a página,
   * só para os gráficos por função e por dia.
   */
  const [saldo, totais, lista, { data: creditos }] = await Promise.all([
    saldoIA(true),
    totaisIA(agora),
    todasAsLinhas<{ funcao: string; custo_usd: number; criado_em: string }>((de, ate) =>
      sb
        .from("ia_uso")
        .select("funcao, custo_usd, criado_em")
        .gte("criado_em", trintaDias)
        .order("id")
        .range(de, ate),
    ),
    sb.from("ia_creditos").select("id, valor_usd, descricao, criado_em").order("criado_em", { ascending: false }).limit(20),
  ]);

  const gastoHoje = totais.gastoHoje;
  const gastoMes = totais.gastoMes;

  // Por onde o dinheiro foi
  const porFuncaoMapa = new Map<string, { custo: number; chamadas: number }>();
  for (const u of lista as any[]) {
    const atual = porFuncaoMapa.get(u.funcao) ?? { custo: 0, chamadas: 0 };
    atual.custo += Number(u.custo_usd ?? 0);
    atual.chamadas += 1;
    porFuncaoMapa.set(u.funcao, atual);
  }
  const porFuncao = [...porFuncaoMapa.entries()]
    .map(([funcao, v]) => ({ funcao, ...v }))
    .sort((a, b) => b.custo - a.custo);

  // Últimos 30 dias, dia a dia
  const porDiaMapa = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    porDiaMapa.set(diaEmSaoPaulo(new Date(agora.getTime() - i * 86400_000)), 0);
  }
  for (const u of lista as any[]) {
    const dia = diaEmSaoPaulo(new Date(u.criado_em));
    if (porDiaMapa.has(dia)) porDiaMapa.set(dia, (porDiaMapa.get(dia) ?? 0) + Number(u.custo_usd ?? 0));
  }
  const porDia = [...porDiaMapa.entries()].map(([dia, custo]) => ({ dia, custo }));

  // Média dos últimos 7 dias, para estimar quanto tempo o saldo aguenta
  const seteDias = porDia.slice(-7).reduce((s, d) => s + d.custo, 0) / 7;
  const diasRestantes = seteDias > 0 ? Math.floor(saldo.saldo / seteDias) : null;

  return NextResponse.json({
    saldo,
    gastoHoje,
    gastoMes,
    mediaDiaria: seteDias,
    diasRestantes,
    porFuncao,
    porDia,
    creditos: creditos ?? [],
    empresa: auth!.empresa,
  });
}

/** Registra um depósito de créditos. */
export async function POST(request: Request) {
  const { erro, auth } = await somenteGestor();
  if (erro) return erro;

  const corpo = await request.json().catch(() => ({}));
  const valor = Number(corpo.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ erro: "Informe um valor maior que zero." }, { status: 400 });
  }

  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 });

  const { error } = await sb.from("ia_creditos").insert({
    valor_usd: valor,
    descricao: String(corpo.descricao ?? "").slice(0, 200) || null,
    criado_por: auth!.userId,
  });
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, saldo: await saldoIA(true) });
}

/** Ajusta preços por milhão de tokens, limite de alerta e bloqueio. */
export async function PATCH(request: Request) {
  const { erro } = await somenteGestor();
  if (erro) return erro;

  const corpo = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  if (corpo.precoEntrada !== undefined) patch.preco_entrada_usd = Number(corpo.precoEntrada);
  if (corpo.precoSaida !== undefined) patch.preco_saida_usd = Number(corpo.precoSaida);
  if (corpo.alerta !== undefined) patch.alerta_saldo_usd = Number(corpo.alerta);
  if (corpo.bloquear !== undefined) patch.bloquear_sem_saldo = Boolean(corpo.bloquear);

  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 });

  const { error } = await sb.from("ia_config").update(patch).eq("id", true);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, saldo: await saldoIA(true) });
}

/** Remove um depósito lançado errado. */
export async function DELETE(request: Request) {
  const { erro } = await somenteGestor();
  if (erro) return erro;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ erro: "Informe o depósito." }, { status: 400 });

  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 });

  const { error } = await sb.from("ia_creditos").delete().eq("id", id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, saldo: await saldoIA(true) });
}
