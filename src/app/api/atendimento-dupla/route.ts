import { NextResponse } from "next/server";
import { getEmpresaAutenticada, mandaNaLoja } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CARGOS_QUE_ATENDEM = ["Vendedor", "Vendedor Interno", "Gestor", "Diretor"];

/**
 * Atendimento em dupla: passar o atendimento de um cliente para um colega e
 * seguir os dois trabalhando juntos.
 *
 * O caso real: a vendedora interna atende, repassa para a colega, as duas
 * conversam com a cliente e, no fechamento, o valor é dividido entre as duas —
 * e as duas precisam continuar vendo a conversa.
 *
 * GET  → os colegas da minha loja para quem eu posso passar um atendimento.
 * POST → convida (ou troca) o parceiro de um cliente, com a divisão combinada.
 * POST com parceiroId null → desfaz a dupla.
 *
 * QUEM PODE: o dono do cliente, e o gestor aprovado da loja. Um terceiro
 * vendedor não entra na carteira de ninguém para convidar a si mesmo — isso
 * seria a mistura de leads que o sistema inteiro existe para impedir.
 *
 * O QUE A DUPLA ALCANÇA: o cliente, os negócios dele AINDA EM ABERTO e a
 * conversa de WhatsApp. Negócio já fechado ou perdido fica como estava: a
 * divisão de uma venda que já aconteceu não se muda por aqui, senão daria para
 * entrar numa venda antiga e levar metade dela.
 */
export async function GET() {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { data, error } = await auth.supabase
    .from("profiles")
    .select("id, nome, cargo")
    .eq("empresa", auth.empresa)
    .eq("ativo", true)
    .is("excluido_em", null)
    .in("cargo", CARGOS_QUE_ATENDEM)
    .neq("id", auth.userId)
    .order("nome");

  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  return NextResponse.json({ colegas: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const corpo = await request.json().catch(() => ({}));
  const relacionamentoId = String(corpo.relacionamentoId ?? "").trim();
  const parceiroId = corpo.parceiroId ? String(corpo.parceiroId).trim() : null;
  const motivo = String(corpo.motivo ?? "").trim() || null;

  if (!relacionamentoId) {
    return NextResponse.json({ erro: "Informe o cliente." }, { status: 400 });
  }

  // A divisão chega como número de 0 a 100 (a fatia do parceiro). Fora da
  // faixa é recusado em vez de aparado: aparar em silêncio esconderia um erro
  // de digitação que mexe em dinheiro.
  let percentual = 50;
  if (corpo.percentual !== undefined && corpo.percentual !== null && corpo.percentual !== "") {
    percentual = Number(corpo.percentual);
    if (!Number.isFinite(percentual) || percentual < 0 || percentual > 100) {
      return NextResponse.json(
        { erro: "A divisão precisa ser um número de 0 a 100." },
        { status: 400 },
      );
    }
  }

  const service = getSupabaseServiceClient();
  if (!service) {
    return NextResponse.json({ erro: "Supabase (service role) não configurado." }, { status: 500 });
  }

  // O cliente é lido com o service client porque o gestor precisa poder fazer
  // isto para a equipe dele, e a checagem de quem pode vem logo abaixo,
  // explícita — não implícita na RLS.
  const { data: cliente } = await service
    .from("relacionamentos")
    .select("id, nome, owner_id, empresa, parceiro_id")
    .eq("id", relacionamentoId)
    .maybeSingle();

  if (!cliente) {
    return NextResponse.json({ erro: "Cliente não encontrado." }, { status: 404 });
  }

  const souODono = cliente.owner_id === auth.userId;
  const souGestorDaLoja =
    (mandaNaLoja(auth) && cliente.empresa === auth.empresa) || auth.gestorMestre;
  if (!souODono && !souGestorDaLoja) {
    return NextResponse.json(
      { erro: "Só quem atende o cliente (ou o gestor da loja) pode passar o atendimento." },
      { status: 403 },
    );
  }

  // ------------------------------------------------------------ desfazer
  if (!parceiroId) {
    const anterior = cliente.parceiro_id;
    await service
      .from("relacionamentos")
      .update({
        parceiro_id: null,
        parceria_em: null,
        parceria_motivo: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", relacionamentoId);

    // Só os negócios em aberto. O fechado guarda a dupla que fechou ele.
    const { data: etapasFechadas } = await service
      .from("etapas_funil")
      .select("nome")
      .eq("empresa", cliente.empresa)
      .in("tipo", ["ganho", "perda"]);
    const fechadas = (etapasFechadas ?? []).map((e) => e.nome as string);

    let q = service
      .from("oportunidades")
      .update({ parceiro_id: null, updated_at: new Date().toISOString() })
      .eq("relacionamento_id", relacionamentoId);
    if (fechadas.length) q = q.not("etapa", "in", `(${fechadas.map((n) => `"${n}"`).join(",")})`);
    await q;

    await service
      .from("whatsapp_ia_leads")
      .update({ parceiro_id: null, updated_at: new Date().toISOString() })
      .eq("relacionamento_id", relacionamentoId);

    if (anterior) {
      await service.from("notificacoes").insert({
        vendedor_id: anterior,
        titulo: "Atendimento em dupla encerrado",
        mensagem: `${cliente.nome} voltou a ser atendido por uma pessoa só. Você não vê mais esta conversa.`,
        tipo: "equipe",
        lida: false,
        acao_url: "/relacionamentos",
      });
    }

    return NextResponse.json({ ok: true, dupla: null });
  }

  // ------------------------------------------------------------- convidar
  if (parceiroId === cliente.owner_id) {
    return NextResponse.json(
      { erro: "O parceiro tem que ser outra pessoa — esse cliente já é dele." },
      { status: 400 },
    );
  }

  const { data: parceiro } = await service
    .from("profiles")
    .select("id, nome, empresa, cargo, ativo, excluido_em")
    .eq("id", parceiroId)
    .maybeSingle();

  if (!parceiro) {
    return NextResponse.json({ erro: "Colega não encontrado." }, { status: 404 });
  }
  if (parceiro.ativo !== true || parceiro.excluido_em) {
    return NextResponse.json(
      { erro: `${parceiro.nome} está com a conta desativada.` },
      { status: 400 },
    );
  }
  // A dupla não atravessa lojas, pela mesma razão que a carteira não
  // atravessa: o cliente é de uma loja, e o relatório de cada loja soma o que
  // é dela.
  if (parceiro.empresa !== cliente.empresa) {
    return NextResponse.json(
      { erro: `${parceiro.nome} é de outra loja. O atendimento em dupla é dentro da mesma loja.` },
      { status: 400 },
    );
  }
  if (!CARGOS_QUE_ATENDEM.includes(String(parceiro.cargo))) {
    return NextResponse.json(
      { erro: `${parceiro.nome} não atende cliente (cargo ${parceiro.cargo}).` },
      { status: 400 },
    );
  }

  const agora = new Date().toISOString();

  const { error: erroCliente } = await service
    .from("relacionamentos")
    .update({
      parceiro_id: parceiroId,
      percentual_parceiro: percentual,
      parceria_em: agora,
      parceria_motivo: motivo,
      updated_at: agora,
    })
    .eq("id", relacionamentoId);
  if (erroCliente) {
    return NextResponse.json({ erro: erroCliente.message }, { status: 400 });
  }

  const { data: etapasFechadas } = await service
    .from("etapas_funil")
    .select("nome")
    .eq("empresa", cliente.empresa)
    .in("tipo", ["ganho", "perda"]);
  const fechadas = (etapasFechadas ?? []).map((e) => e.nome as string);

  let qOp = service
    .from("oportunidades")
    .update(
      { parceiro_id: parceiroId, percentual_parceiro: percentual, updated_at: agora },
      { count: "exact" },
    )
    .eq("relacionamento_id", relacionamentoId);
  if (fechadas.length) {
    qOp = qOp.not("etapa", "in", `(${fechadas.map((n) => `"${n}"`).join(",")})`);
  }
  const { count: negocios } = await qOp;

  const { count: conversas } = await service
    .from("whatsapp_ia_leads")
    .update({ parceiro_id: parceiroId, updated_at: agora }, { count: "exact" })
    .eq("relacionamento_id", relacionamentoId);

  await service.from("notificacoes").insert({
    vendedor_id: parceiroId,
    titulo: "Você entrou num atendimento em dupla",
    mensagem:
      `${cliente.nome} agora é atendido por vocês dois. Você vê a conversa e os negócios em aberto, ` +
      `e quando a venda fechar ${percentual}% do valor é seu.` +
      (motivo ? ` Motivo: ${motivo}` : ""),
    tipo: "equipe",
    lida: false,
    acao_url: "/relacionamentos",
  });

  return NextResponse.json({
    ok: true,
    dupla: {
      parceiroId,
      parceiroNome: parceiro.nome,
      percentual,
      negocios: negocios ?? 0,
      conversas: conversas ?? 0,
    },
  });
}
