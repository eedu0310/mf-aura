import { NextResponse } from "next/server";
import { administra, getEmpresaAutenticada, vejoTodasAsLojas } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { NOMES_EMPRESAS } from "@/lib/companies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function somenteGestor() {
  const auth = await getEmpresaAutenticada();
  if (!auth) return { erro: NextResponse.json({ erro: "Não autenticado." }, { status: 401 }) };
  if (!administra(auth)) {
    return { erro: NextResponse.json({ erro: "Só o gestor configura isso." }, { status: 403 }) };
  }
  return { auth };
}

/** Links de avaliação por loja, e o andamento dos pedidos. */
export async function GET() {
  const { auth, erro } = await somenteGestor();
  if (erro) return erro;

  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 });

  // O cliente de serviço ignora a RLS: sem este filtro o gestor de uma loja
  // lia os pedidos (com nome de cliente) das outras três.
  let consultaConfig = sb.from("config_avaliacao").select("*").order("empresa");
  let consultaPedidos = sb
    .from("pedidos_avaliacao")
    .select("id, empresa, cliente, vendedor_id, enviado_em, aberto_em, confirmado_em, criado_em")
    .order("criado_em", { ascending: false })
    .limit(100);
  if (!vejoTodasAsLojas(auth)) {
    consultaConfig = consultaConfig.eq("empresa", auth.empresa);
    consultaPedidos = consultaPedidos.eq("empresa", auth.empresa);
  }
  const [{ data: config }, { data: pedidos }] = await Promise.all([consultaConfig, consultaPedidos]);

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

/**
 * Normaliza um link de avaliação. Vai para o cliente final pelo vendedor,
 * então só http(s) com um domínio de verdade — nada de "javascript:" ou de
 * texto solto que vire link quebrado na mensagem.
 * Devolve null para "apagar" e undefined para "inválido".
 */
function limparLink(v: unknown): string | null | undefined {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const comEsquema = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  try {
    const url = new URL(comEsquema);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    if (!url.hostname.includes(".")) return undefined;
    return url.toString().slice(0, 500);
  } catch {
    return undefined;
  }
}

/** Salva os links de uma loja. */
export async function PATCH(request: Request) {
  const { auth, erro } = await somenteGestor();
  if (erro) return erro;

  const corpo = await request.json().catch(() => ({}));
  const empresa = String(corpo.empresa ?? "").trim();
  if (!empresa) return NextResponse.json({ erro: "Informe a loja." }, { status: 400 });
  if (!NOMES_EMPRESAS.includes(empresa)) {
    return NextResponse.json({ erro: "Loja inválida." }, { status: 400 });
  }
  // Gestor de loja trocava o link de avaliação das outras lojas — o cliente
  // de uma loja recebia o Google de outra.
  if (!vejoTodasAsLojas(auth) && empresa !== auth.empresa) {
    return NextResponse.json({ erro: "Você só configura a sua loja." }, { status: 403 });
  }

  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 });

  const patch: Record<string, unknown> = { empresa, atualizado_em: new Date().toISOString() };
  const links = [
    ["linkGoogle", "link_google"],
    ["linkInstagram", "link_instagram"],
    ["linkFacebook", "link_facebook"],
  ] as const;
  for (const [campo, coluna] of links) {
    if (corpo[campo] === undefined) continue;
    const link = limparLink(corpo[campo]);
    if (link === undefined) {
      return NextResponse.json({ erro: "Link inválido. Use um endereço http(s)." }, { status: 400 });
    }
    patch[coluna] = link;
  }
  if (corpo.mensagem !== undefined) patch.mensagem_padrao = String(corpo.mensagem).slice(0, 1000);
  if (corpo.mensagemRedes !== undefined) patch.mensagem_redes = String(corpo.mensagemRedes).slice(0, 1000) || null;

  const { error } = await sb.from("config_avaliacao").upsert(patch, { onConflict: "empresa" });
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
