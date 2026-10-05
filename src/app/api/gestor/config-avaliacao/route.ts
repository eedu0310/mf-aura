import { NextResponse } from "next/server";
import { getEmpresaAutenticada, mandaNaLoja } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function somenteGestor() {
  const auth = await getEmpresaAutenticada();
  if (!auth) return { erro: NextResponse.json({ erro: "Não autenticado." }, { status: 401 }) };
  if (!mandaNaLoja(auth)) {
    return { erro: NextResponse.json({ erro: "Só o gestor configura isso." }, { status: 403 }) };
  }
  return { auth };
}

/** Links de avaliação por loja, e o andamento dos pedidos. */
export async function GET() {
  const { erro } = await somenteGestor();
  if (erro) return erro;

  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 });

  const [{ data: config }, { data: pedidos }] = await Promise.all([
    sb.from("config_avaliacao").select("*").order("empresa"),
    sb
      .from("pedidos_avaliacao")
      .select("id, empresa, cliente, vendedor_id, enviado_em, aberto_em, confirmado_em, criado_em")
      .order("criado_em", { ascending: false })
      .limit(100),
  ]);

  const lista = pedidos ?? [];
  return NextResponse.json({
    config: config ?? [],
    pedidos: lista,
    resumo: {
      total: lista.length,
      enviados: lista.filter((p) => p.enviado_em).length,
      abertos: lista.filter((p) => p.aberto_em).length,
      confirmados: lista.filter((p) => p.confirmado_em).length,
    },
  });
}

/** Salva os links de uma loja. */
export async function PATCH(request: Request) {
  const { erro } = await somenteGestor();
  if (erro) return erro;

  const corpo = await request.json().catch(() => ({}));
  const empresa = String(corpo.empresa ?? "").trim();
  if (!empresa) return NextResponse.json({ erro: "Informe a loja." }, { status: 400 });

  const limpar = (v: unknown) => {
    const s = String(v ?? "").trim();
    if (!s) return null;
    return /^https?:\/\//i.test(s) ? s : `https://${s}`;
  };

  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 });

  const patch: Record<string, unknown> = { empresa, atualizado_em: new Date().toISOString() };
  if (corpo.linkGoogle !== undefined) patch.link_google = limpar(corpo.linkGoogle);
  if (corpo.linkInstagram !== undefined) patch.link_instagram = limpar(corpo.linkInstagram);
  if (corpo.linkFacebook !== undefined) patch.link_facebook = limpar(corpo.linkFacebook);
  if (corpo.mensagem !== undefined) patch.mensagem_padrao = String(corpo.mensagem).slice(0, 600);

  const { error } = await sb.from("config_avaliacao").upsert(patch, { onConflict: "empresa" });
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
