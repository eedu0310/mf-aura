import { NextResponse } from "next/server";
import { getEmpresaAutenticada, mandaNaLoja } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { carregarFunil } from "@/lib/funil-servidor";
import { ehFechada, ehGanho, exigeValor } from "@/lib/funil";
import { getMessages } from "@/lib/whatsapp/live-manager";
import { sinaisDoRelacionamento } from "@/lib/gestor/ficha-relacionamento";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A ficha completa de um relacionamento, para o gestor.
 *
 * Pedido de 21/10: o gestor clica no relacionamento e vê de onde veio o lead,
 * para quem chegou, com quem está, quanto vale, como está a conversa e se
 * está esfriando — para chegar no vendedor e ajudar antes de perder a venda.
 *
 * Tudo numa resposta, montada no servidor: são oito tabelas, e algumas
 * (leads recebidos, transferências) o navegador do gestor nem carrega.
 *
 * ALCANCE: gestor aprovado vê a própria loja; o gestor mestre, todas.
 *
 * POST { id, mensagem } — "pedir atenção": manda uma notificação ao vendedor
 * dono do contato (e ao parceiro, se atende em dupla).
 */

async function autorizar(id: string | null) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return { erro: NextResponse.json({ erro: "Não autenticado." }, { status: 401 }) };
  if (!mandaNaLoja(auth)) return { erro: NextResponse.json({ erro: "Só o gestor aprovado vê a ficha completa." }, { status: 403 }) };
  if (!id) return { erro: NextResponse.json({ erro: "Informe o relacionamento." }, { status: 400 }) };
  const sb = getSupabaseServiceClient();
  if (!sb) return { erro: NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 }) };
  const { data: rel } = await sb.from("relacionamentos").select("*").eq("id", id).maybeSingle();
  if (!rel) return { erro: NextResponse.json({ erro: "Relacionamento não encontrado." }, { status: 404 }) };
  if (!auth.gestorMestre && rel.empresa !== auth.empresa) {
    return { erro: NextResponse.json({ erro: "Este contato é de outra loja." }, { status: 403 }) };
  }
  return { auth, sb, rel };
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  const r = await autorizar(id);
  if ("erro" in r) return r.erro;
  const { sb, rel } = r;

  const [ops, vendas, ativs, totalAtivs, comps, leads, waLeads, funil] = await Promise.all([
    sb.from("oportunidades").select("id, etapa, valor, produto, owner_id, created_at, updated_at, motivo_perda").eq("relacionamento_id", rel.id).order("created_at", { ascending: false }),
    sb.from("vendas").select("id, valor, valor_fechado, produto, data, owner_id").eq("relacionamento_id", rel.id).order("data", { ascending: false }),
    sb.from("atividades").select("id, tipo, titulo, resultado, proximo_passo, owner_id, ocorrida_em, created_at").eq("relacionamento_id", rel.id).order("created_at", { ascending: false }).limit(8),
    sb.from("atividades").select("id", { count: "exact", head: true }).eq("relacionamento_id", rel.id),
    sb.from("compromissos").select("id, titulo, tipo, data, hora, concluido").eq("relacionamento_id", rel.id).order("data", { ascending: false }).limit(5),
    sb.from("leads_recebidos").select("id, origem, created_at, vendedor_id, sdr_id, respondido_em, respondido_por, status, classificacao, urgencia, resumo_ia").eq("relacionamento_id", rel.id).order("created_at", { ascending: true }),
    sb.from("whatsapp_ia_leads").select("owner_id, chat_jid, resumo, proxima_acao, alertas, interesse, valor_estimado, etapa, ultima_analise_em, anuncio_titulo, anuncio_plataforma, anuncio_em, created_at").eq("relacionamento_id", rel.id).order("ultima_analise_em", { ascending: false, nullsFirst: false }).limit(1),
    carregarFunil(sb, rel.empresa),
  ]);

  const campanha = rel.campanha_id
    ? (await sb.from("campanhas_marketing").select("nome, canal").eq("id", rel.campanha_id).maybeSingle()).data
    : null;

  // Quem é quem: dono atual, parceiro, quem recebeu o lead, quem fez cada atividade.
  const ids = new Set<string>();
  if (rel.owner_id) ids.add(rel.owner_id);
  if (rel.parceiro_id) ids.add(rel.parceiro_id);
  for (const l of leads.data ?? []) {
    if (l.vendedor_id) ids.add(l.vendedor_id);
    if (l.sdr_id) ids.add(l.sdr_id);
  }
  for (const a of ativs.data ?? []) if (a.owner_id) ids.add(a.owner_id);
  const { data: perfis } = ids.size
    ? await sb.from("profiles").select("id, nome, cargo").in("id", [...ids])
    : { data: [] as { id: string; nome: string; cargo: string }[] };
  const nome = (pid: string | null | undefined) => (pid ? perfis?.find((p) => p.id === pid)?.nome ?? "—" : null);

  const abertos = (ops.data ?? []).filter((o) => !ehFechada(o.etapa, funil));
  const ganhos = (ops.data ?? []).filter((o) => ehGanho(o.etapa, funil));
  const valorEmAberto = abertos.reduce((s, o) => s + Number(o.valor ?? 0), 0);
  const valorVendido = (vendas.data ?? []).reduce((s, v) => s + Number(v.valor_fechado ?? v.valor ?? 0), 0);

  // O cliente está esperando? Só dá para saber pela conversa ao vivo, que
  // fica na memória do servidor do WhatsApp do vendedor.
  const wa = waLeads.data?.[0] ?? null;
  let clienteEsperandoDesde: string | null = null;
  let ultimaMensagem: { deQuem: "cliente" | "vendedor"; em: string; texto: string } | null = null;
  if (wa?.owner_id && wa.chat_jid) {
    const msgs = getMessages(wa.owner_id, wa.chat_jid);
    const ultima = msgs[msgs.length - 1];
    if (ultima) {
      const em = new Date(ultima.timestamp).toISOString();
      ultimaMensagem = { deQuem: ultima.fromMe ? "vendedor" : "cliente", em, texto: (ultima.text || "").slice(0, 160) };
      if (!ultima.fromMe) clienteEsperandoDesde = em;
    }
  }

  // Último contato: o mais recente entre o cadastro, as atividades e o WhatsApp.
  const candidatos = [
    rel.ultimo_contato_em,
    ativs.data?.[0]?.ocorrida_em ?? ativs.data?.[0]?.created_at,
    ultimaMensagem?.em,
  ].filter(Boolean) as string[];
  const ultimoContatoEm = candidatos.length ? candidatos.sort().at(-1)! : null;

  const primeiroLead = leads.data?.[0] ?? null;
  const leadSemResposta = (leads.data ?? []).find((l) => !l.respondido_em && l.status !== "respondido") ?? null;

  const sinais = sinaisDoRelacionamento({
    agora: new Date(),
    ultimoContatoEm,
    proximoContatoEm: rel.proximo_contato_em ?? null,
    negociosAbertos: abertos.map((o) => ({
      etapa: o.etapa,
      valor: Number(o.valor ?? 0),
      atualizadoEm: o.updated_at,
      exigeValor: exigeValor(o.etapa, funil),
    })),
    leadSemResposta: leadSemResposta ? { chegouEm: leadSemResposta.created_at } : null,
    clienteEsperandoDesde,
    temperatura: rel.temperatura ?? null,
  });

  return NextResponse.json({
    contato: {
      id: rel.id,
      nome: rel.nome,
      empresa: rel.empresa,
      categoria: rel.categoria,
      temperatura: rel.temperatura,
      cadastradoEm: rel.created_at,
      ultimoContatoEm,
      proximoContatoEm: rel.proximo_contato_em ?? null,
    },
    pessoas: {
      vendedor: nome(rel.owner_id),
      parceiro: nome(rel.parceiro_id),
      percentualParceiro: rel.parceiro_id ? rel.percentual_parceiro ?? 50 : null,
      // Para quem o lead chegou primeiro (pode ser diferente do dono atual,
      // se foi repassado ou a carteira foi transferida).
      recebidoPor: primeiroLead ? nome(primeiroLead.vendedor_id ?? primeiroLead.sdr_id) : null,
      recebidoEm: primeiroLead?.created_at ?? null,
      respondidoEm: primeiroLead?.respondido_em ?? null,
      repassado: !!primeiroLead?.vendedor_id && primeiroLead.vendedor_id !== rel.owner_id,
    },
    origem: {
      tipo: rel.origem_lead ?? null,
      descricao: rel.origem ?? null,
      campanha: campanha ? `${campanha.nome}${campanha.canal ? ` (${campanha.canal})` : ""}` : null,
      anuncio: wa?.anuncio_titulo
        ? { titulo: wa.anuncio_titulo, plataforma: wa.anuncio_plataforma, em: wa.anuncio_em }
        : null,
      canalDeEntrada: primeiroLead?.origem ?? (wa ? "WhatsApp" : null),
      classificacaoIa: primeiroLead?.classificacao ?? null,
      urgencia: primeiroLead?.urgencia ?? null,
    },
    valores: {
      emAberto: valorEmAberto,
      vendido: valorVendido,
      estimadoPelaIa: wa?.valor_estimado != null ? Number(wa.valor_estimado) : null,
      negociosAbertos: abertos.length,
      negociosGanhos: ganhos.length,
    },
    negocios: (ops.data ?? []).map((o) => ({
      id: o.id,
      etapa: o.etapa,
      valor: Number(o.valor ?? 0),
      produto: o.produto,
      aberto: !ehFechada(o.etapa, funil),
      diasNaEtapa: o.updated_at ? Math.floor((Date.now() - new Date(o.updated_at).getTime()) / 86_400_000) : null,
      motivoPerda: o.motivo_perda,
    })),
    vendas: (vendas.data ?? []).map((v) => ({ id: v.id, valor: Number(v.valor_fechado ?? v.valor ?? 0), produto: v.produto, data: v.data })),
    whatsapp: wa
      ? {
          resumo: wa.resumo,
          proximaAcao: wa.proxima_acao,
          interesse: wa.interesse,
          alertas: Array.isArray(wa.alertas) ? wa.alertas : [],
          analisadoEm: wa.ultima_analise_em,
          ultimaMensagem,
        }
      : null,
    atividades: {
      total: totalAtivs.count ?? 0,
      ultimas: (ativs.data ?? []).map((a) => ({
        id: a.id,
        tipo: a.tipo,
        titulo: a.titulo,
        resultado: a.resultado,
        proximoPasso: a.proximo_passo,
        quem: nome(a.owner_id),
        em: a.ocorrida_em ?? a.created_at,
      })),
    },
    agenda: (comps.data ?? []).map((c) => ({ id: c.id, titulo: c.titulo, tipo: c.tipo, data: c.data, hora: c.hora, concluido: c.concluido })),
    sinais,
  });
}

export async function POST(request: Request) {
  const corpo = await request.json().catch(() => ({}));
  const r = await autorizar(typeof corpo.id === "string" ? corpo.id : null);
  if ("erro" in r) return r.erro;
  const { sb, rel, auth } = r;

  const texto = String(corpo.mensagem ?? "").trim().slice(0, 500);
  if (!texto) return NextResponse.json({ erro: "Escreva o que você quer que o vendedor faça." }, { status: 400 });
  if (!rel.owner_id) return NextResponse.json({ erro: "Este contato não tem vendedor." }, { status: 400 });

  const { data: eu } = await sb.from("profiles").select("nome").eq("id", auth.userId).maybeSingle();
  const destinos = [rel.owner_id, rel.parceiro_id].filter((x, i, a): x is string => !!x && a.indexOf(x) === i && x !== auth.userId);
  if (destinos.length === 0) return NextResponse.json({ erro: "O contato é seu; não há para quem avisar." }, { status: 400 });

  const { error } = await sb.from("notificacoes").insert(
    destinos.map((vendedorId) => ({
      vendedor_id: vendedorId,
      titulo: `📣 ${eu?.nome ?? "O gestor"} pediu atenção: ${rel.nome}`,
      mensagem: texto,
      tipo: "alerta",
      lida: false,
      acao_url: "/relacionamentos",
      criada_em: new Date().toISOString(),
    })),
  );
  if (error) return NextResponse.json({ erro: `Não consegui avisar: ${error.message}` }, { status: 500 });
  return NextResponse.json({ ok: true, avisados: destinos.length });
}
