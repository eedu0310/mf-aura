import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** As medidas que o sistema sabe calcular, para a tela montar o seletor. */
const MEDIDAS = [
  { valor: "avaliacao_conquistada", rotulo: "Avaliações conquistadas", ajuda: "Conta quando o cliente abre o link ou o gestor confirma — não quando o vendedor manda." },
  { valor: "recompra", rotulo: "Recompra", ajuda: "Venda para cliente que já havia comprado antes do período." },
  { valor: "prospeccao_fechada", rotulo: "Prospecção que fechou", ajuda: "Contato novo trazido no período que chegou a Fechados." },
  { valor: "venda_nova", rotulo: "Vendas fechadas", ajuda: "Quantidade de negócios fechados no período." },
  { valor: "faturamento", rotulo: "Faturamento", ajuda: "Soma vendida no período, em reais." },
  { valor: "prospeccao", rotulo: "Prospecção por categoria", ajuda: "Contatos novos. Escolha a categoria no campo ao lado." },
  { valor: "atividades", rotulo: "Atividades registradas", ajuda: "Quantidade de atividades lançadas no período." },
  { valor: "crm_em_dia", rotulo: "CRM em dia", ajuda: "Percentual de preenchimento: próximo contato, categoria e último contato. Meta 100." },
];

const CATEGORIAS = [
  "Cliente Final", "Arquiteto", "Construtora", "Obra",
  "Consultor", "Revendedor", "Engenheiro", "Designer de Interiores",
];

async function somenteGestor() {
  const auth = await getEmpresaAutenticada();
  if (!auth) return { erro: NextResponse.json({ erro: "Não autenticado." }, { status: 401 }) };
  if (auth.cargo !== "Gestor") {
    return { erro: NextResponse.json({ erro: "Só o gestor configura o ranking." }, { status: 403 }) };
  }
  return { auth };
}

export async function GET() {
  const { erro } = await somenteGestor();
  if (erro) return erro;

  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 });

  const [{ data: config }, { data: criterios }] = await Promise.all([
    sb.from("ranking_config").select("*").maybeSingle(),
    sb.from("ranking_criterios").select("*").order("ordem"),
  ]);

  return NextResponse.json({
    config,
    criterios: criterios ?? [],
    medidas: MEDIDAS,
    categorias: CATEGORIAS,
  });
}

/** Ajusta o corte do bônus, o texto e a chave da MF. */
export async function PATCH(request: Request) {
  const { erro } = await somenteGestor();
  if (erro) return erro;

  const corpo = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };

  if (corpo.bonusCrmMinimo !== undefined) {
    const n = Math.round(Number(corpo.bonusCrmMinimo));
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return NextResponse.json({ erro: "O corte do bônus vai de 0 a 100." }, { status: 400 });
    }
    patch.bonus_crm_minimo = n;
  }
  if (corpo.bonusDescricao !== undefined) patch.bonus_descricao = String(corpo.bonusDescricao).slice(0, 200);
  if (corpo.mfNoRanking !== undefined) patch.mf_no_ranking_do_grupo = Boolean(corpo.mfNoRanking);

  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 });

  const { error } = await sb.from("ranking_config").update(patch).eq("id", true);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

/** Cria um critério novo. */
export async function POST(request: Request) {
  const { erro } = await somenteGestor();
  if (erro) return erro;

  const c = await request.json().catch(() => ({}));
  if (!MEDIDAS.some((m) => m.valor === c.medida)) {
    return NextResponse.json({ erro: "Escolha o que este critério mede." }, { status: 400 });
  }
  if (!String(c.titulo ?? "").trim()) {
    return NextResponse.json({ erro: "Dê um nome ao critério." }, { status: 400 });
  }

  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 });

  const { data: ultimo } = await sb
    .from("ranking_criterios")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await sb.from("ranking_criterios").insert({
    medida: c.medida,
    titulo: String(c.titulo).trim().slice(0, 120),
    descricao: String(c.descricao ?? "").slice(0, 300) || null,
    peso: Math.min(Math.max(Number(c.peso) || 1, 0), 10),
    meta_mes: Math.max(Number(c.metaMes) || 1, 0.01),
    categoria_alvo: c.categoriaAlvo ? String(c.categoriaAlvo) : null,
    ordem: (ultimo?.ordem ?? 0) + 1,
  });
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

/** Edita peso, meta, título ou liga/desliga um critério. */
export async function PUT(request: Request) {
  const { erro } = await somenteGestor();
  if (erro) return erro;

  const c = await request.json().catch(() => ({}));
  if (!c.id) return NextResponse.json({ erro: "Informe o critério." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (c.titulo !== undefined) patch.titulo = String(c.titulo).trim().slice(0, 120);
  if (c.descricao !== undefined) patch.descricao = String(c.descricao).slice(0, 300) || null;
  if (c.peso !== undefined) patch.peso = Math.min(Math.max(Number(c.peso) || 0, 0), 10);
  if (c.metaMes !== undefined) patch.meta_mes = Math.max(Number(c.metaMes) || 1, 0.01);
  if (c.categoriaAlvo !== undefined) patch.categoria_alvo = c.categoriaAlvo || null;
  if (c.ativo !== undefined) patch.ativo = Boolean(c.ativo);

  if (!Object.keys(patch).length) {
    return NextResponse.json({ erro: "Nada para atualizar." }, { status: 400 });
  }

  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 });

  const { error } = await sb.from("ranking_criterios").update(patch).eq("id", c.id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

/** Remove um critério. */
export async function DELETE(request: Request) {
  const { erro } = await somenteGestor();
  if (erro) return erro;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ erro: "Informe o critério." }, { status: 400 });

  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 });

  const { error } = await sb.from("ranking_criterios").delete().eq("id", id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
