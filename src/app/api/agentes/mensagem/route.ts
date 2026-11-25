import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { administra, getEmpresaAutenticada, vejoTodasAsLojas } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { chamarIA, temMigracao108 } from "@/lib/agentes/motor";
import { MOTIVO_SEM_108, ehUuid } from "@/lib/agentes/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

/**
 * "Gerar mensagem" no card de um agente.
 *
 * Corpo: { recomendacaoId: string, refazer?: boolean }
 * Resposta: { mensagem: string, telefone: string | null }
 *
 * A IA escreve uma mensagem curta de WhatsApp para o VENDEDOR enviar — a
 * AURA nunca envia nada ao cliente (regra 1 do contrato dos agentes). Lê o
 * card, o cliente (ou negócio, ou pós-venda) e o resumo que o supervisor do
 * WhatsApp já gravou dessa conversa, se houver — só leitura. Telefone e
 * e-mail NÃO vão para a IA; o telefone volta só para a tela montar o link
 * "Abrir WhatsApp".
 *
 * Quem pode: o dono do card, ou o gestor aprovado da loja (ou o mestre).
 * A mensagem fica guardada em mensagem_sugerida; pedir de novo devolve a
 * mesma, a menos que venha refazer: true.
 */
export async function POST(request: Request) {
  const auth = await getEmpresaAutenticada(request);
  if (!auth) return NextResponse.json({ erro: "Faça login novamente." }, { status: 401 });

  let corpo: { recomendacaoId?: unknown; refazer?: unknown };
  try {
    corpo = (await request.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  if (!ehUuid(corpo.recomendacaoId)) return NextResponse.json({ erro: "Informe recomendacaoId." }, { status: 400 });

  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 });
  if (!(await temMigracao108(sb))) return NextResponse.json({ erro: MOTIVO_SEM_108 }, { status: 409 });

  const { data: rec } = await sb
    .from("aura_recomendacoes")
    .select("id, vendedor_id, empresa, titulo, descricao, entidade_tipo, entidade_id, mensagem_sugerida")
    .eq("id", corpo.recomendacaoId)
    .maybeSingle();
  if (!rec) return NextResponse.json({ erro: "Recomendação não encontrada." }, { status: 404 });

  const ehDono = rec.vendedor_id === auth.userId;
  const ehGestorDaLoja = administra(auth) && (vejoTodasAsLojas(auth) || rec.empresa === auth.empresa);
  if (!ehDono && !ehGestorDaLoja) {
    return NextResponse.json({ erro: "Esta recomendação não é sua." }, { status: 403 });
  }

  const entidade = await lerEntidade(sb, rec.entidade_tipo as string | null, rec.entidade_id as string | null);
  if (!entidade) {
    return NextResponse.json({ erro: "Esta recomendação não tem um cliente ligado para escrever a mensagem." }, { status: 400 });
  }

  if (rec.mensagem_sugerida && corpo.refazer !== true) {
    return NextResponse.json({ mensagem: rec.mensagem_sugerida, telefone: entidade.telefone });
  }

  const conversa = await resumoDaConversa(sb, entidade.relacionamentoId, entidade.oportunidadeId);
  const { data: vendedor } = await sb.from("profiles").select("nome").eq("id", rec.vendedor_id).maybeSingle();
  const primeiroNome = String(vendedor?.nome ?? "").trim().split(/\s+/)[0] || null;

  const texto = await chamarIA({
    funcao: "agentes/mensagem",
    perfil: "rapido",
    maxTokens: 400,
    empresa: rec.empresa as string,
    usuarioId: auth.userId,
    sistema: `Você escreve mensagens de WhatsApp para um vendedor de uma loja de lareiras e aquecimento (${rec.empresa}) mandar a um cliente.
REGRAS
- Português do Brasil natural, como uma pessoa escreveria no WhatsApp: curta (2 a 4 frases), cordial, sem formalidade excessiva.
- No máximo um emoji, e só se combinar; de preferência nenhum.
- NUNCA invente preço, valor, desconto, prazo, data, horário ou condição de pagamento. Se precisar disso, faça uma pergunta em vez de afirmar.
- Use o primeiro nome do cliente, se souber. Não assine e não se apresente com cargo.
- Termine com uma pergunta simples que facilite a resposta.
- Devolva SÓ o texto da mensagem, sem aspas e sem explicação.`,
    usuario: JSON.stringify(
      {
        motivoDoContato: { titulo: rec.titulo, detalhe: rec.descricao },
        vendedor: primeiroNome,
        cliente: entidade.resumo,
        conversaNoWhatsApp: conversa,
      },
      null,
      2,
    ),
  });

  const mensagem = typeof texto === "string" ? texto.trim().replace(/^["“]|["”]$/g, "").trim() : "";
  if (!mensagem) {
    return NextResponse.json({ erro: "A IA não conseguiu escrever agora (saldo, orçamento ou falha). Tente de novo em instantes." }, { status: 503 });
  }
  await sb.from("aura_recomendacoes").update({ mensagem_sugerida: mensagem }).eq("id", rec.id);
  return NextResponse.json({ mensagem, telefone: entidade.telefone });
}

interface Entidade {
  /** O que vai para a IA (sem telefone nem e-mail). */
  resumo: Record<string, unknown>;
  /** Só para o link "Abrir WhatsApp" na tela; nunca vai para a IA. */
  telefone: string | null;
  relacionamentoId: string | null;
  oportunidadeId: string | null;
}

async function telefoneDoContato(sb: SupabaseClient, relacionamentoId: string | null): Promise<string | null> {
  if (!relacionamentoId) return null;
  const { data } = await sb.from("relacionamentos").select("telefone").eq("id", relacionamentoId).maybeSingle();
  return (data?.telefone as string | null) ?? null;
}

async function lerEntidade(sb: SupabaseClient, tipo: string | null, id: string | null): Promise<Entidade | null> {
  if (!tipo || !ehUuid(id)) return null;
  if (tipo === "relacionamento") {
    const { data } = await sb
      .from("relacionamentos")
      .select("id, nome, categoria, cidade, temperatura, ultimo_contato_em, proximo_contato_em, empresa_cliente, telefone")
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    const { telefone, ...resto } = data;
    return { resumo: { tipo: "contato da carteira", ...resto }, telefone: (telefone as string | null) ?? null, relacionamentoId: data.id as string, oportunidadeId: null };
  }
  if (tipo === "oportunidade") {
    const { data } = await sb
      .from("oportunidades")
      .select("id, cliente, produto, etapa, updated_at, relacionamento_id")
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    const relacionamentoId = (data.relacionamento_id as string | null) ?? null;
    return {
      resumo: { tipo: "negócio em andamento", cliente: data.cliente, produto: data.produto, etapa: data.etapa, ultimaMudanca: data.updated_at },
      telefone: await telefoneDoContato(sb, relacionamentoId),
      relacionamentoId,
      oportunidadeId: data.id as string,
    };
  }
  if (tipo === "pos_venda") {
    const { data } = await sb
      .from("pos_vendas")
      .select("id, cliente, produto, status, instalacao_agendada_em, instalacao_realizada_em, possui_reclamacao, reclamacao_resolvida, relacionamento_id, oportunidade_id, telefone")
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    const relacionamentoId = (data.relacionamento_id as string | null) ?? null;
    const { telefone, ...resto } = data;
    return {
      resumo: { tipo: "pós-venda", ...resto },
      telefone: (telefone as string | null) ?? (await telefoneDoContato(sb, relacionamentoId)),
      relacionamentoId,
      oportunidadeId: (data.oportunidade_id as string | null) ?? null,
    };
  }
  return null;
}

/** O que o supervisor do WhatsApp já resumiu desta conversa (só leitura). */
async function resumoDaConversa(
  sb: SupabaseClient,
  relacionamentoId: string | null,
  oportunidadeId: string | null,
): Promise<Record<string, unknown> | null> {
  const filtros: string[] = [];
  if (relacionamentoId) filtros.push(`relacionamento_id.eq.${relacionamentoId}`, `carteira_relacionamento_id.eq.${relacionamentoId}`);
  if (oportunidadeId) filtros.push(`oportunidade_id.eq.${oportunidadeId}`);
  if (!filtros.length) return null;
  const { data } = await sb
    .from("whatsapp_ia_leads")
    .select("resumo, proxima_acao, etapa, interesse, ultima_analise_em")
    .or(filtros.join(","))
    .order("ultima_analise_em", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (!data || (!data.resumo && !data.proxima_acao)) return null;
  return data as Record<string, unknown>;
}
