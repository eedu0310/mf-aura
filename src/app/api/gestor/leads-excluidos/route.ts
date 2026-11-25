import { NextResponse } from "next/server";
import { administra, getEmpresaAutenticada, vejoTodasAsLojas } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lixeira de leads (migração 116).
 *
 * GET  /api/gestor/leads-excluidos[?loja=]  o que foi excluído, por quem e de onde veio
 * POST /api/gestor/leads-excluidos {id}     restaura (a função do banco confere a loja)
 *
 * Gestor da loja vê a própria loja; o mestre vê todas (e filtra pela loja).
 */
export async function GET(request: Request) {
  const auth = await getEmpresaAutenticada(request);
  if (!auth) return NextResponse.json({ erro: "Usuário não autenticado." }, { status: 401 });
  if (!administra(auth)) return NextResponse.json({ erro: "Só o gestor vê a lixeira de leads." }, { status: 403 });
  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Banco não configurado." }, { status: 500 });

  const mestre = vejoTodasAsLojas(auth);
  const lojaPedida = new URL(request.url).searchParams.get("loja");
  const loja = mestre ? lojaPedida || null : auth.empresa;

  let consulta = sb
    .from("leads_lixeira")
    .select("id, lead_id, empresa, nome, origem, status, vendedor_id, dados, excluido_em, excluido_por, como, restaurado_em, restaurado_por")
    .order("excluido_em", { ascending: false })
    .limit(500);
  if (loja) consulta = consulta.eq("empresa", loja);
  const { data, error } = await consulta;
  if (error) return NextResponse.json({ erro: "Não consegui ler a lixeira." }, { status: 500 });

  const linhas = data ?? [];
  const ids = [...new Set(linhas.flatMap((l) => [l.vendedor_id, l.excluido_por, l.restaurado_por]).filter(Boolean))] as string[];
  const nomes = new Map<string, string>();
  if (ids.length) {
    const { data: perfis } = await sb.from("profiles").select("id, nome").in("id", ids);
    for (const p of perfis ?? []) nomes.set(p.id, p.nome);
  }

  const { data: lojasLinhas } = mestre ? await sb.from("leads_lixeira").select("empresa") : { data: null };
  const lojas = mestre ? [...new Set((lojasLinhas ?? []).map((l) => l.empresa).filter(Boolean))].sort() : [auth.empresa];

  return NextResponse.json({
    lojas,
    itens: linhas.map((l) => {
      const d = (l.dados ?? {}) as Record<string, unknown>;
      return {
        id: l.id,
        leadId: l.lead_id,
        loja: l.empresa,
        nome: l.nome,
        telefone: (d.telefone as string | null) ?? null,
        email: (d.email as string | null) ?? null,
        origem: l.origem,
        status: l.status,
        mensagem: typeof d.mensagem_inicial === "string" ? d.mensagem_inicial.slice(0, 300) : null,
        chegouEm: (d.created_at as string | null) ?? null,
        vendedor: l.vendedor_id ? (nomes.get(l.vendedor_id) ?? "—") : null,
        excluidoEm: l.excluido_em,
        excluidoPor: l.excluido_por ? (nomes.get(l.excluido_por) ?? "—") : null,
        como: l.como,
        restauradoEm: l.restaurado_em,
        restauradoPor: l.restaurado_por ? (nomes.get(l.restaurado_por) ?? "—") : null,
      };
    }),
  });
}

export async function POST(request: Request) {
  const auth = await getEmpresaAutenticada(request);
  if (!auth) return NextResponse.json({ erro: "Usuário não autenticado." }, { status: 401 });
  if (!administra(auth)) return NextResponse.json({ erro: "Só o gestor restaura leads." }, { status: 403 });
  let corpo: { id?: string };
  try {
    corpo = (await request.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  if (!corpo.id) return NextResponse.json({ erro: "Informe o item da lixeira." }, { status: 400 });

  // Com o login de quem pede: a função do banco confere se ele manda na loja do lead.
  const { error } = await auth.supabase.rpc("aura_restaurar_lead", { p_lixeira: corpo.id });
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
