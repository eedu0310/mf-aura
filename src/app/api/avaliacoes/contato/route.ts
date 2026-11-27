import { NextResponse } from "next/server";
import { getEmpresaAutenticada, vejoTodasAsLojas } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O pedido de avaliação de UM contato, para o painel do WhatsApp.
 *
 * Pedido de 24/11: a Deise fechou vendas e o link de avaliação não aparecia
 * na conversa do cliente. O pedido existia (nasce com a venda), mas só no
 * Meu Dia e, quase sempre, sem telefone. Aqui o painel acha o pedido pela
 * ficha do cliente, pelo telefone ou, por último, pelo nome, e recebe junto
 * a configuração de avaliação da loja.
 *
 * Também devolve a configuração de todas as lojas que a pessoa enxerga, para
 * o "Enviar rápido" ter o link de avaliação de cada loja, separado.
 */
export async function GET(request: Request) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const sb = auth.supabase;
  const sp = new URL(request.url).searchParams;
  const relacionamento = (sp.get("relacionamento") ?? "").trim();
  const digitos = (sp.get("telefone") ?? "").replace(/\D/g, "");
  const nome = (sp.get("nome") ?? "").trim();

  const { data: configs } = await sb
    .from("config_avaliacao")
    .select("empresa, link_google, link_instagram, link_facebook, mensagem_padrao, mensagem_redes")
    .order("empresa");

  const campos = "id, venda_id, empresa, cliente, telefone, token, enviado_em, confirmado_em, criado_em";
  let pedido: Record<string, unknown> | null = null;

  // 1) Pela ficha: as vendas desse cliente.
  if (relacionamento) {
    const { data: vendas } = await sb.from("vendas").select("id").eq("relacionamento_id", relacionamento).limit(50);
    const ids = (vendas ?? []).map((v) => v.id);
    if (ids.length) {
      const { data } = await sb
        .from("pedidos_avaliacao")
        .select(campos)
        .in("venda_id", ids)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      pedido = data;
    }
  }

  // 2) Pelo telefone (os 10 últimos dígitos: DDD + número, com ou sem o 9).
  if (!pedido && digitos.length >= 10) {
    const fim = digitos.slice(-8);
    const { data } = await sb
      .from("pedidos_avaliacao")
      .select(campos)
      .ilike("telefone", `%${fim.slice(0, 4)}%${fim.slice(4)}%`)
      .order("criado_em", { ascending: false })
      .limit(5);
    pedido = (data ?? []).find((p) => String(p.telefone ?? "").replace(/\D/g, "").endsWith(fim)) ?? null;
  }

  // 3) Pelo nome, só entre os pedidos ainda não enviados do próprio vendedor:
  //    as vendas lançadas pelo Pipeline costumam vir sem telefone.
  if (!pedido && nome.length >= 3 && !/^[+\d(]/.test(nome)) {
    const { data } = await sb
      .from("pedidos_avaliacao")
      .select(campos)
      .eq("vendedor_id", auth.userId)
      .is("enviado_em", null)
      .ilike("cliente", nome.replace(/[%_]/g, ""))
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    pedido = data;
  }

  // 4) Pelo primeiro nome, ainda entre os pendentes do próprio vendedor: o
  //    nome do contato no WhatsApp ("Geneci Obra Farroupilha") raramente é
  //    igual ao da venda ("Geneci"). Só vale se achar UM pedido, para não
  //    mandar o link de outro cliente.
  if (!pedido && nome.length >= 3 && !/^[+\d(]/.test(nome)) {
    const primeiro = nome.split(/\s+/)[0].replace(/[%_]/g, "");
    if (primeiro.length >= 3) {
      const { data } = await sb
        .from("pedidos_avaliacao")
        .select(campos)
        .eq("vendedor_id", auth.userId)
        .is("enviado_em", null)
        .ilike("cliente", `${primeiro}%`)
        .order("criado_em", { ascending: false })
        .limit(2);
      if ((data ?? []).length === 1) pedido = data![0];
    }
  }

  return NextResponse.json({
    empresa: auth.empresa,
    // O gestor mestre atende pelas quatro lojas: vê o link de cada uma.
    todas: vejoTodasAsLojas(auth),
    pedido,
    configs: configs ?? [],
  });
}

/**
 * Cria (ou devolve) o pedido de avaliação de um contato sem venda lançada,
 * para o link que vai na conversa ser o /av/<token> da AURA e não o do Google
 * direto (27/11/2026). Só assim a abertura do cliente fica registrada.
 */
export async function POST(request: Request) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const corpo = await request.json().catch(() => ({}));
  const empresa = String(corpo.empresa ?? "").trim() || auth.empresa;
  const digitos = String(corpo.telefone ?? "").replace(/\D/g, "");
  const nome = String(corpo.nome ?? "").trim().slice(0, 120);
  if (!empresa || digitos.length < 10) {
    return NextResponse.json({ erro: "Informe a loja e o telefone do cliente." }, { status: 400 });
  }
  if (empresa !== auth.empresa && !vejoTodasAsLojas(auth)) {
    return NextResponse.json({ erro: "Loja de outra equipe." }, { status: 403 });
  }
  // Quem não é gestor não grava em pedidos_avaliacao (não há regra de
  // inserção para o vendedor): grava o servidor, em nome de quem pediu.
  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Banco indisponível." }, { status: 503 });

  const campos = "id, venda_id, empresa, cliente, telefone, token, enviado_em, confirmado_em, criado_em";
  const fim = digitos.slice(-8);
  const { data: existentes } = await sb
    .from("pedidos_avaliacao")
    .select(campos)
    .eq("empresa", empresa)
    .ilike("telefone", `%${fim.slice(0, 4)}%${fim.slice(4)}%`)
    .order("criado_em", { ascending: false })
    .limit(5);
  const jaTem = (existentes ?? []).find((p) => String(p.telefone ?? "").replace(/\D/g, "").endsWith(fim));
  if (jaTem) return NextResponse.json({ pedido: jaTem });

  const { data, error } = await sb
    .from("pedidos_avaliacao")
    .insert({ empresa, vendedor_id: auth.userId, cliente: nome || null, telefone: digitos })
    .select(campos)
    .single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ pedido: data });
}
