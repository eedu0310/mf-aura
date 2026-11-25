import { NextResponse } from "next/server";
import { administra, getEmpresaAutenticada, vejoTodasAsLojas } from "@/lib/auth-empresa";
import { todasAsLinhas } from "@/lib/supabase/todas-as-linhas";
import { CATEGORIAS, categoriaDe, semRepetidos, type Categoria } from "@/lib/aura/categorias-recomendacao";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { nomesDosAgentes } from "@/lib/agentes/motor";
import { faltaNoBanco } from "@/lib/agentes/util";

export const runtime = "nodejs";

/**
 * GET /api/aura/supervisao                 as prioridades de quem pede
 * GET /api/aura/supervisao?escopo=equipe   (gestor) resumo por vendedor e loja
 * GET /api/aura/supervisao?vendedor=<id>   (gestor) as prioridades de um vendedor
 *
 * O gestor via só as prioridades endereçadas a ele, e misturadas: não tinha
 * como olhar loja por loja nem vendedor por vendedor. As duas leituras novas
 * usam a chave de serviço e por isso conferem o alcance aqui: gestor da loja
 * vê a própria loja; o mestre, todas. Vendedor continua vendo só as dele.
 */
export async function GET(request: Request) {
  const auth = await getEmpresaAutenticada(request);
  if (!auth) return NextResponse.json({ erro: "Usuário não autenticado." }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const escopo = sp.get("escopo");
  const vendedorPedido = sp.get("vendedor");
  if (escopo === "equipe" || vendedorPedido) {
    if (!administra(auth)) return NextResponse.json({ erro: "Só o gestor vê as prioridades da equipe." }, { status: 403 });
    const sb = getSupabaseServiceClient();
    if (!sb) return NextResponse.json({ erro: "Banco não configurado." }, { status: 500 });
    const mestre = vejoTodasAsLojas(auth);
    const { data: perfis } = await sb
      .from("profiles")
      .select("id, nome, empresa, cargo, ativo, excluido_em")
      .is("excluido_em", null);
    const equipe = (perfis ?? []).filter(
      (p) => p.ativo !== false && (mestre || p.empresa === auth.empresa),
    ) as Array<{ id: string; nome: string; empresa: string; cargo: string }>;
    const ids = new Set(equipe.map((p) => p.id));

    if (vendedorPedido) {
      if (!ids.has(vendedorPedido)) {
        return NextResponse.json({ erro: "Este vendedor não é da sua loja." }, { status: 403 });
      }
      const { data, error } = await sb
        .from("aura_recomendacoes")
        .select("id,titulo,descricao,prioridade,status,entidade_tipo,entidade_id,prazo,criado_em,agente,acao_url,vendedor_id,empresa")
        .eq("vendedor_id", vendedorPedido)
        .eq("status", "pendente")
        .order("criado_em", { ascending: false })
        .limit(500);
      if (error) return NextResponse.json({ erro: "Não foi possível carregar as recomendações." }, { status: 500 });
      const nomes = await nomesDosAgentes(sb).catch(() => new Map<string, string>());
      return NextResponse.json({
        somenteLeitura: true,
        recomendacoes: (data ?? []).map((l) => ({
          ...l,
          agente_nome: l.agente ? (nomes.get(l.agente) ?? l.agente) : null,
          pode_gerar_mensagem: false,
        })),
      });
    }

    // Resumo da equipe: só o que é preciso para contar (sem descrição).
    const linhas = await todasAsLinhas<{
      id: string;
      vendedor_id: string;
      titulo: string;
      prioridade: string;
      agente: string | null;
      entidade_tipo: string | null;
      entidade_id: string | null;
    }>((de, ate) =>
      sb
        .from("aura_recomendacoes")
        .select("id,vendedor_id,titulo,prioridade,agente,entidade_tipo,entidade_id")
        .eq("status", "pendente")
        .order("id")
        .range(de, ate),
    ).catch(() => []);
    const porVendedor = new Map<string, typeof linhas>();
    for (const l of linhas) {
      if (!ids.has(l.vendedor_id)) continue;
      const lista = porVendedor.get(l.vendedor_id) ?? [];
      lista.push(l);
      porVendedor.set(l.vendedor_id, lista);
    }
    const resumo = equipe
      .map((p) => {
        const itens = semRepetidos(porVendedor.get(p.id) ?? []);
        const porCategoria: Partial<Record<Categoria, number>> = {};
        for (const i of itens) {
          const c = categoriaDe(i);
          porCategoria[c] = (porCategoria[c] ?? 0) + 1;
        }
        return {
          id: p.id,
          nome: p.nome,
          loja: p.empresa,
          cargo: p.cargo,
          voce: p.id === auth.userId,
          total: itens.length,
          urgentes: itens.filter((i) => i.prioridade === "urgente").length,
          altas: itens.filter((i) => i.prioridade === "alta").length,
          porCategoria,
        };
      })
      .filter((v) => v.total > 0)
      .sort((a, b) => a.loja.localeCompare(b.loja) || b.urgentes - a.urgentes || b.altas - a.altas || b.total - a.total);
    return NextResponse.json({ resumo, categorias: CATEGORIAS });
  }

  /*
   * Com a migração 110 a recomendação também pode vir de um AGENTE: traz
   * quem mandou (agente, agente_nome), para onde o botão leva (acao_url), se
   * mostra "Gerar mensagem" (pode_gerar_mensagem) e a mensagem já gerada.
   * Sem a 110 essas colunas não existem e a lista sai como antes.
   */
  const BASICO = "id,titulo,descricao,prioridade,status,entidade_tipo,entidade_id,prazo,criado_em";
  const DOS_AGENTES = "agente,acao_url,pode_gerar_mensagem,mensagem_sugerida,expira_em";
  const consultar = (colunas: string) =>
    auth.supabase
      .from("aura_recomendacoes")
      .select(colunas)
      .eq("vendedor_id", auth.userId)
      .eq("status", "pendente")
      .order("criado_em", { ascending: false })
      // A tela agora separa por tipo e mostra "ver mais": dá para trazer a
      // fila inteira (antes eram 60, e o que passava disso nem aparecia).
      .limit(500);

  let resposta = await consultar(`${BASICO},${DOS_AGENTES}`);
  if (resposta.error && faltaNoBanco(resposta.error)) resposta = await consultar(BASICO);
  const { data, error } = resposta;
  if (error) return NextResponse.json({ erro: "Não foi possível carregar as recomendações." }, { status: 500 });

  const linhas = (data ?? []) as unknown as Array<Record<string, unknown>>;
  let nomes = new Map<string, string>();
  if (linhas.some((l) => l.agente)) {
    const sb = getSupabaseServiceClient();
    if (sb) nomes = await nomesDosAgentes(sb).catch(() => new Map<string, string>());
  }
  const recomendacoes = linhas.map((l) => ({
    ...l,
    agente: (l.agente as string | null | undefined) ?? null,
    agente_nome: l.agente ? (nomes.get(l.agente as string) ?? (l.agente as string)) : null,
    acao_url: (l.acao_url as string | null | undefined) ?? null,
    pode_gerar_mensagem: l.pode_gerar_mensagem === true,
  }));
  return NextResponse.json({ recomendacoes });
}

export async function PATCH(request: Request) {
  const auth = await getEmpresaAutenticada(request);
  if (!auth) return NextResponse.json({ erro: "Usuário não autenticado." }, { status: 401 });

  let body: { id?: string; status?: "concluida" | "dispensada" };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  if (!body.id || !body.status) return NextResponse.json({ erro: "Informe id e status." }, { status: 400 });
  // O tipo acima é só promessa: sem esta checagem qualquer texto virava status.
  if (body.status !== "concluida" && body.status !== "dispensada") {
    return NextResponse.json({ erro: "Status inválido." }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from("aura_recomendacoes")
    .update({ status: body.status, concluida_em: body.status === "concluida" ? new Date().toISOString() : null })
    .eq("id", body.id)
    .eq("vendedor_id", auth.userId);
  if (error) return NextResponse.json({ erro: "Não foi possível atualizar a recomendação." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
