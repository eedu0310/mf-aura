import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pedidos de avaliação do vendedor (ou de todo o grupo, para o gestor). */
export async function GET(request: Request) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const sb = auth.supabase;

  let q = sb
    .from("pedidos_avaliacao")
    .select("id, venda_id, vendedor_id, empresa, cliente, telefone, token, canal, enviado_em, aberto_em, confirmado_em, criado_em")
    .order("criado_em", { ascending: false })
    .limit(100);

  if (sp.get("pendentes") === "1") q = q.is("enviado_em", null);
  if (auth.cargo !== "Gestor") q = q.eq("vendedor_id", auth.userId);

  const [{ data: pedidos, error }, { data: config }] = await Promise.all([
    q,
    sb.from("config_avaliacao").select("empresa, link_google, link_instagram, link_facebook, mensagem_padrao"),
  ]);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ pedidos: pedidos ?? [], config: config ?? [] });
}

/** Marca que o vendedor enviou o link, ou que o gestor confirmou a avaliação. */
export async function PATCH(request: Request) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const corpo = await request.json().catch(() => ({}));
  const id = String(corpo.id ?? "");
  if (!id) return NextResponse.json({ erro: "Informe o pedido." }, { status: 400 });

  const patch: Record<string, unknown> = {};
  const agora = new Date().toISOString();

  if (corpo.enviado) patch.enviado_em = agora;
  if (corpo.canal) patch.canal = String(corpo.canal);
  if (corpo.confirmado !== undefined) {
    // Confirmar que o cliente avaliou de fato é decisão de gente: o Google
    // não avisa ninguém. Por isso fica com o gestor.
    if (auth.cargo !== "Gestor") {
      return NextResponse.json({ erro: "Só o gestor confirma a avaliação." }, { status: 403 });
    }
    patch.confirmado_em = corpo.confirmado ? agora : null;
    patch.confirmado_por = corpo.confirmado ? auth.userId : null;
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ erro: "Nada para atualizar." }, { status: 400 });
  }

  const { error } = await auth.supabase.from("pedidos_avaliacao").update(patch).eq("id", id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
