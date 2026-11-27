import { NextResponse } from "next/server";
import { getEmpresaAutenticada, mandaNaLoja, vejoTodasAsLojas } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { todasAsLinhas } from "@/lib/supabase/todas-as-linhas";
import { carregarFunil } from "@/lib/funil-servidor";
import { colunaDoNegocio, ehFechada, ehGanho, ehPerda } from "@/lib/funil";
import { somaDoVendedor, vendasDoVendedor } from "@/lib/parceria";
import { buscarUltimaAtividade, diasParadoDaLinha, DIAS_PARA_PARADO } from "@/lib/oportunidade-parada";
import { negocioEmAberto, pipelineAberto, totalVendido } from "@/lib/kpis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O painel do gestor, separado por loja → vendedor → conversa / negociação.
 *
 * O pedido foi literal: "deixa tudo bem separado, lojas, vendedores, conversas
 * e relatórios da IA de cada conversa e cada negociação dos vendedores". Antes
 * o gestor tinha dezesseis abas no mesmo nível e nenhuma delas descia até a
 * conversa de um vendedor específico — para ler o laudo da IA sobre uma
 * conversa era preciso entrar na tela do WhatsApp e procurar.
 *
 * Esta rota responde em QUATRO NÍVEIS, escolhidos pelo que vem na URL:
 *
 *   (nada)              as lojas, com o placar de cada uma
 *   ?loja=X             os vendedores daquela loja, com o placar de cada um
 *   ?vendedor=Y         as conversas e as negociações daquela pessoa
 *   ?conversa=Z         o laudo completo da IA sobre aquela conversa
 *   ?negocio=W          por que aquele negócio andou ou travou
 *
 * Em quatro chamadas pequenas, e não uma gigante: o gestor quase nunca desce
 * até o último nível, e carregar 698 conversas com histórico para mostrar
 * quatro lojas era o caminho mais curto para a tela travar.
 *
 * ALCANCE: gestor aprovado vê a própria loja; só o gestor mestre atravessa as
 * quatro. Conferido em cada nível, não só na entrada — descer um nível com um
 * id de outra loja na mão é exatamente como se contorna uma checagem feita só
 * no começo.
 */
export async function GET(request: Request) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  /*
   * Quem atravessa as quatro lojas é o mestre com cargo Gestor aprovado
   * (vejoTodasAsLojas). Antes bastava a flag gestor_mestre: sem cargo nem
   * aprovação, ela abria vendas, conversas e laudos de todas as lojas.
   */
  const mestre = vejoTodasAsLojas(auth);
  if (!mandaNaLoja(auth)) {
    return NextResponse.json({ erro: "Só o gestor da loja vê este painel." }, { status: 403 });
  }

  const sb = getSupabaseServiceClient();
  if (!sb) {
    return NextResponse.json({ erro: "Supabase (service role) não configurado." }, { status: 500 });
  }

  const url = new URL(request.url);
  const loja = url.searchParams.get("loja")?.trim() || null;
  const vendedorId = url.searchParams.get("vendedor")?.trim() || null;
  const conversaId = url.searchParams.get("conversa")?.trim() || null;
  const negocioId = url.searchParams.get("negocio")?.trim() || null;
  // `|| 90`: "?dias=abc" virava NaN, a data inválida e um 500 no toISOString.
  const dias = Math.min(Math.max(Number(url.searchParams.get("dias") ?? 90) || 90, 7), 365);
  const desde = new Date(Date.now() - dias * 86400e3).toISOString();

  /** O gestor que não é mestre só enxerga a própria loja, em qualquer nível. */
  function podeVer(empresaDoRegistro: string | null | undefined): boolean {
    if (mestre) return true;
    return !!empresaDoRegistro && empresaDoRegistro === auth!.empresa;
  }
  const fora = () =>
    NextResponse.json({ erro: "Isto é de outra loja." }, { status: 403 });

  // ------------------------------------------------------- nível 4: conversa
  if (conversaId) {
    const { data: c } = await sb
      .from("whatsapp_ia_leads")
      .select(
        "id, empresa, owner_id, parceiro_id, nome, telefone, etapa, resumo, proxima_acao, dicas, alertas, historico, interesse, valor_estimado, natureza, categoria, motivo_natureza, lead_sugerido, confianca_lead, motivo_sugestao, auto_enviado_em, auto_texto, ultima_analise_em, created_at, updated_at, relacionamento_id, oportunidade_id",
      )
      .eq("id", conversaId)
      .maybeSingle();
    if (!c) return NextResponse.json({ erro: "Conversa não encontrada." }, { status: 404 });
    if (!podeVer(c.empresa as string)) return fora();

    const ids = [c.owner_id, c.parceiro_id].filter(Boolean) as string[];
    const { data: pessoas } = await sb.from("profiles").select("id, nome").in("id", ids);

    return NextResponse.json({
      nivel: "conversa",
      conversa: {
        ...c,
        vendedorNome: pessoas?.find((p) => p.id === c.owner_id)?.nome ?? null,
        parceiroNome: pessoas?.find((p) => p.id === c.parceiro_id)?.nome ?? null,
      },
    });
  }

  // ------------------------------------------------------- nível 4: negócio
  if (negocioId) {
    const { data: o } = await sb
      .from("oportunidades")
      .select(
        "id, empresa, owner_id, parceiro_id, percentual_parceiro, cliente, produto, valor, etapa, probabilidade, motivo_perda, descricao_perda, data_perda, dias_parado, relacionamento_id, created_at, updated_at",
      )
      .eq("id", negocioId)
      .maybeSingle();
    if (!o) return NextResponse.json({ erro: "Negócio não encontrado." }, { status: 404 });
    if (!podeVer(o.empresa as string)) return fora();

    // A trilha de por que o negócio andou (ou não). A IA e a mão do vendedor
    // gravam o motivo no contexto da atividade; é o que responde "onde errei".
    const [{ data: movimentos }, { data: conversa }, { data: fechamento }, { data: pessoas }] =
      await Promise.all([
        sb
          .from("atividades")
          .select("id, titulo, contexto, tipo, origem, created_at, ocorrida_em")
          .or(
            `titulo.ilike.IA moveu%,titulo.ilike.Oportunidade movida%,titulo.ilike.Etapa alterada%,titulo.ilike.Oportunidade criada%`,
          )
          .eq("relacionamento_id", o.relacionamento_id ?? "00000000-0000-0000-0000-000000000000")
          .order("created_at", { ascending: false })
          .limit(50),
        sb
          .from("whatsapp_ia_leads")
          .select("id, nome, resumo, proxima_acao, alertas, ultima_analise_em")
          .eq("oportunidade_id", negocioId)
          .maybeSingle(),
        sb
          .from("aura_feedback_fechamento")
          .select("resultado, resumo, acertos, erros, etapas_puladas, ponto_fraco, motivo_informado, criado_em")
          .eq("oportunidade_id", negocioId)
          .order("criado_em", { ascending: false })
          .limit(1),
        sb
          .from("profiles")
          .select("id, nome")
          .in("id", [o.owner_id, o.parceiro_id].filter(Boolean) as string[]),
      ]);

    const funil = await carregarFunil(sb, o.empresa as string);
    const ultimaAtividade = await buscarUltimaAtividade(sb, [o.relacionamento_id as string | null]);

    return NextResponse.json({
      nivel: "negocio",
      negocio: {
        ...o,
        // Calculado (oportunidade-parada.ts): a coluna estava em 0 em tudo.
        dias_parado: diasParadoDaLinha(o, ultimaAtividade.get(o.relacionamento_id as string)),
        coluna: colunaDoNegocio(o.etapa as string, funil),
        fechado: ehFechada(o.etapa as string, funil),
        // Em jogo (src/lib/kpis.ts): só estes podem estar "parados" — pós-venda não.
        emAberto: negocioEmAberto(o.etapa as string, funil),
        ganho: ehGanho(o.etapa as string, funil),
        perdido: ehPerda(o.etapa as string, funil),
        vendedorNome: pessoas?.find((p) => p.id === o.owner_id)?.nome ?? null,
        parceiroNome: pessoas?.find((p) => p.id === o.parceiro_id)?.nome ?? null,
      },
      movimentos: movimentos ?? [],
      conversa: conversa ?? null,
      fechamento: fechamento?.[0] ?? null,
    });
  }

  // ------------------------------------------------- nível 3: um vendedor
  if (vendedorId) {
    const { data: pessoa } = await sb
      .from("profiles")
      .select("id, nome, empresa, cargo, ativo, excluido_em")
      .eq("id", vendedorId)
      .maybeSingle();
    if (!pessoa) return NextResponse.json({ erro: "Pessoa não encontrada." }, { status: 404 });
    if (!podeVer(pessoa.empresa as string)) return fora();

    const funil = await carregarFunil(sb, pessoa.empresa as string);
    const meu = `owner_id.eq.${vendedorId},parceiro_id.eq.${vendedorId}`;

    const [conversas, { data: negocios }, { data: supervisoes }] = await Promise.all([
      // Todas: o cartão da loja dizia 817 conversas e a lista parava em 300 (27/11/2026).
      todasAsLinhas((de, ate) =>
        sb
          .from("whatsapp_ia_leads")
          .select(
            "id, nome, telefone, etapa, resumo, proxima_acao, alertas, natureza, categoria, owner_id, parceiro_id, oportunidade_id, ultima_analise_em, updated_at, ignorado",
          )
          .or(meu)
          .gte("updated_at", desde)
          .order("updated_at", { ascending: false })
          .order("id")
          .range(de, ate),
      ),
      sb
        .from("oportunidades")
        .select(
          "id, cliente, produto, valor, etapa, probabilidade, motivo_perda, owner_id, parceiro_id, percentual_parceiro, relacionamento_id, created_at, updated_at",
        )
        .or(meu)
        .order("updated_at", { ascending: false })
        .limit(300),
      sb
        .from("aura_supervisoes")
        .select("id, resumo, score, riscos, janela_inicio, janela_fim, criado_em")
        .eq("vendedor_id", vendedorId)
        .order("criado_em", { ascending: false })
        .limit(10),
    ]);

    const ultimaAtividadeDoVendedor = await buscarUltimaAtividade(
      sb,
      (negocios ?? []).map((o) => o.relacionamento_id as string | null),
    );

    return NextResponse.json({
      nivel: "vendedor",
      vendedor: {
        id: pessoa.id,
        nome: pessoa.nome,
        loja: pessoa.empresa,
        cargo: pessoa.cargo,
        ativo: pessoa.ativo !== false && !pessoa.excluido_em,
      },
      conversas: (conversas ?? []).map((c) => ({
        ...c,
        // "Minha" ou "em dupla": o gestor precisa saber de quem é a conversa
        // antes de cobrar alguém por ela.
        papel: c.owner_id === vendedorId ? "dono" : "parceiro",
        qtdAlertas: Array.isArray(c.alertas) ? c.alertas.length : 0,
      })),
      negocios: (negocios ?? []).map((o) => ({
        ...o,
        dias_parado: diasParadoDaLinha(o, ultimaAtividadeDoVendedor.get(o.relacionamento_id as string)),
        coluna: colunaDoNegocio(o.etapa as string, funil),
        fechado: ehFechada(o.etapa as string, funil),
        // Em jogo (src/lib/kpis.ts): só estes podem estar "parados" — pós-venda não.
        emAberto: negocioEmAberto(o.etapa as string, funil),
        ganho: ehGanho(o.etapa as string, funil),
        perdido: ehPerda(o.etapa as string, funil),
        papel: o.owner_id === vendedorId ? "dono" : "parceiro",
      })),
      supervisoes: supervisoes ?? [],
      dias,
    });
  }

  // ------------------------------------------------- nível 2: uma loja
  if (loja) {
    if (!podeVer(loja)) return fora();

    /*
     * Lidas de mil em mil até o fim. Cada consulta parava nas 1000 primeiras
     * linhas sem avisar — e só as atividades de 90 dias de uma loja passam
     * disso —, então o placar de cada vendedor saía cortado ao acaso.
     */
    let pessoas, vendas, negocios, conversas, ativs;
    try {
      [{ data: pessoas }, vendas, negocios, conversas, ativs] = await Promise.all([
        sb
          .from("profiles")
          .select("id, nome, cargo, ativo, excluido_em")
          .eq("empresa", loja)
          .is("excluido_em", null)
          .order("nome"),
        todasAsLinhas((de, ate) =>
          sb
            .from("vendas")
            .select("owner_id, parceiro_id, percentual_parceiro, valor, valor_fechado, data")
            .eq("empresa", loja)
            .gte("data", desde.slice(0, 10))
            .order("id")
            .range(de, ate),
        ),
        todasAsLinhas((de, ate) =>
          sb
            .from("oportunidades")
            .select("owner_id, parceiro_id, etapa, valor, relacionamento_id, created_at, updated_at")
            .eq("empresa", loja)
            .order("id")
            .range(de, ate),
        ),
        todasAsLinhas((de, ate) =>
          sb
            .from("whatsapp_ia_leads")
            .select("owner_id, parceiro_id, alertas, resumo, updated_at")
            .eq("empresa", loja)
            .gte("updated_at", desde)
            .order("id")
            .range(de, ate),
        ),
        todasAsLinhas((de, ate) =>
          sb
            .from("atividades")
            .select("owner_id")
            .eq("empresa", loja)
            .gte("created_at", desde)
            .order("id")
            .range(de, ate),
        ),
      ]);
    } catch (e) {
      console.error("[gestor/equipe] loja:", e);
      return NextResponse.json({ erro: "Não consegui ler os números da loja." }, { status: 500 });
    }

    const funil = await carregarFunil(sb, loja);
    // "Parado" calculado da última alteração e da última atividade com o
    // cliente — só dos abertos, que são os únicos que podem estar parados.
    const ultimaAtividadeDaLoja = await buscarUltimaAtividade(
      sb,
      (negocios ?? [])
        .filter((o) => negocioEmAberto(o.etapa as string, funil))
        .map((o) => o.relacionamento_id as string | null),
    );
    const meus = <T extends { owner_id: string | null; parceiro_id?: string | null }>(
      lista: T[] | null,
      id: string,
    ) => (lista ?? []).filter((x) => x.owner_id === id || x.parceiro_id === id);

    return NextResponse.json({
      nivel: "loja",
      loja,
      vendedores: (pessoas ?? [])
        .map((p) => {
          const minhasConversas = meus(conversas, p.id);
          const meusNegocios = meus(negocios, p.id);
          const abertos = meusNegocios.filter((o) => negocioEmAberto(o.etapa as string, funil));
          return {
            id: p.id,
            nome: p.nome,
            cargo: p.cargo,
            ativo: p.ativo !== false,
            vendido: somaDoVendedor(vendas ?? [], p.id),
            vendas: vendasDoVendedor(vendas ?? [], p.id).length,
            conversas: minhasConversas.length,
            // Conversa com alerta é a que a IA marcou como precisando de algo.
            // É por aqui que o gestor escolhe onde olhar primeiro.
            conversasComAlerta: minhasConversas.filter(
              (c) => Array.isArray(c.alertas) && c.alertas.length > 0,
            ).length,
            negociosAbertos: abertos.length,
            // A mesma conta do quadro do Pipeline: só as etapas que contam.
            pipeline: pipelineAberto(meusNegocios, funil).valor,
            negociosParados: abertos.filter(
              (o) =>
                diasParadoDaLinha(o, ultimaAtividadeDaLoja.get(o.relacionamento_id as string)) >=
                DIAS_PARA_PARADO,
            ).length,
            ganhos: meusNegocios.filter((o) => ehGanho(o.etapa as string, funil)).length,
            perdidos: meusNegocios.filter((o) => ehPerda(o.etapa as string, funil)).length,
            atividades: (ativs ?? []).filter((a) => a.owner_id === p.id).length,
          };
        })
        .sort((a, b) => b.vendido - a.vendido || b.conversas - a.conversas),
      dias,
    });
  }

  // ------------------------------------------------- nível 1: as lojas
  const lojasVisiveis = mestre ? null : [auth.empresa];

  let qPessoas = sb
    .from("profiles")
    .select("id, empresa, cargo, ativo, excluido_em")
    .is("excluido_em", null);
  if (lojasVisiveis) qPessoas = qPessoas.in("empresa", lojasVisiveis);

  // Lidas até o fim, de mil em mil: o total das lojas parava nas 1000
  // primeiras linhas (todas as oportunidades do grupo passam disso).
  let pessoas, vendas, negocios, conversas;
  try {
    [{ data: pessoas }, vendas, negocios, conversas] = await Promise.all([
      qPessoas,
      todasAsLinhas((de, ate) => {
        let q = sb
          .from("vendas")
          .select("empresa, owner_id, parceiro_id, percentual_parceiro, valor, valor_fechado")
          .gte("data", desde.slice(0, 10));
        if (lojasVisiveis) q = q.in("empresa", lojasVisiveis);
        return q.order("id").range(de, ate);
      }),
      todasAsLinhas((de, ate) => {
        let q = sb
          .from("oportunidades")
          .select("empresa, etapa, valor, relacionamento_id, created_at, updated_at");
        if (lojasVisiveis) q = q.in("empresa", lojasVisiveis);
        return q.order("id").range(de, ate);
      }),
      todasAsLinhas((de, ate) => {
        let q = sb.from("whatsapp_ia_leads").select("empresa, alertas").gte("updated_at", desde);
        if (lojasVisiveis) q = q.in("empresa", lojasVisiveis);
        return q.order("id").range(de, ate);
      }),
    ]);
  } catch (e) {
    console.error("[gestor/equipe] lojas:", e);
    return NextResponse.json({ erro: "Não consegui ler os números das lojas." }, { status: 500 });
  }

  const nomesDasLojas = [
    ...new Set([
      ...(pessoas ?? []).map((p) => p.empresa as string),
      ...(negocios ?? []).map((o) => o.empresa as string),
    ]),
  ].filter(Boolean);

  // O funil de cada loja primeiro, para saber quais negócios estão abertos e
  // buscar a última atividade só dos clientes deles (uma leitura para todas).
  const funis = new Map<string, Awaited<ReturnType<typeof carregarFunil>>>();
  for (const nome of nomesDasLojas) funis.set(nome, await carregarFunil(sb, nome));
  const ultimaAtividadeDasLojas = await buscarUltimaAtividade(
    sb,
    (negocios ?? [])
      .filter((o) => {
        const f = funis.get(o.empresa as string);
        return !!f && negocioEmAberto(o.etapa as string, f);
      })
      .map((o) => o.relacionamento_id as string | null),
  );

  const lojas = [];
  for (const nome of nomesDasLojas) {
    const funil = funis.get(nome)!;
    const dela = (negocios ?? []).filter((o) => o.empresa === nome);
    const abertos = dela.filter((o) => negocioEmAberto(o.etapa as string, funil));
    const conversasDela = (conversas ?? []).filter((c) => c.empresa === nome);
    lojas.push({
      nome,
      vendedores: (pessoas ?? []).filter(
        (p) => p.empresa === nome && p.ativo !== false && /vendedor/i.test(String(p.cargo ?? "")),
      ).length,
      vendido: totalVendido((vendas ?? []).filter((v) => v.empresa === nome)),
      vendas: (vendas ?? []).filter((v) => v.empresa === nome).length,
      conversas: conversasDela.length,
      conversasComAlerta: conversasDela.filter(
        (c) => Array.isArray(c.alertas) && c.alertas.length > 0,
      ).length,
      negociosAbertos: abertos.length,
      pipeline: pipelineAberto(dela, funil).valor,
      negociosParados: abertos.filter(
        (o) =>
          diasParadoDaLinha(o, ultimaAtividadeDasLojas.get(o.relacionamento_id as string)) >=
          DIAS_PARA_PARADO,
      ).length,
    });
  }

  return NextResponse.json({
    nivel: "lojas",
    souMestre: mestre,
    lojas: lojas.sort((a, b) => b.vendido - a.vendido),
    dias,
  });
}
