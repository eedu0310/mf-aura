import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { equipeDoSite, primeiroNome } from "@/lib/site-mf/servidor";
import { EMPRESA_DO_SITE } from "@/lib/site-mf/tipos";
import { PRESENCA_VALE_MS, limparAtalhos, limparNome } from "@/lib/site-mf/chat";
import { limparHorario } from "@/lib/site-mf/horario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Chat do site, lado da equipe (Site MF → Atendimento).
 *
 * GET ?c=<conversa>           uma conversa com as mensagens (e marca como lida)
 * GET ?resumo=1               não lidas, quem está online, minha presença, config
 * POST { acao: "responder", c, texto }
 *      { acao: "encerrar" | "reabrir", c }
 *      { acao: "presenca", disponivel? }     sinal de vida / liga-desliga
 *      { acao: "config", saudacao, atendentePadraoId, ativo, atalhos, whatsapp, horario, mensagemForaHorario }
 *
 * Quem pode: equipe da MF e gestor mestre (equipeDoSite).
 */
export async function GET(request: Request) {
  const auth = await equipeDoSite(request);
  if (!auth) return NextResponse.json({ erro: "Só a equipe da MF usa esta área." }, { status: 403 });
  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Sistema indisponível." }, { status: 503 });
  const url = new URL(request.url);

  if (url.searchParams.get("resumo")) {
    const desde = new Date(Date.now() - PRESENCA_VALE_MS).toISOString();
    const [{ data: conversas }, { data: presentes }, { data: minha }, { data: config }, { data: equipe }] = await Promise.all([
      sb.from("site_conversas").select("nao_lidas").eq("empresa", EMPRESA_DO_SITE).eq("status", "aberta").gt("nao_lidas", 0),
      sb.from("site_presenca").select("profile_id").eq("empresa", EMPRESA_DO_SITE).eq("disponivel", true).gte("visto_em", desde),
      sb.from("site_presenca").select("disponivel").eq("profile_id", auth.userId).maybeSingle(),
      sb.from("site_chat_config").select("ativo, saudacao, atendente_padrao_id, atalhos, whatsapp, horario, mensagem_fora_horario").eq("empresa", EMPRESA_DO_SITE).maybeSingle(),
      sb.from("profiles").select("id, nome").eq("empresa", EMPRESA_DO_SITE).neq("ativo", false).order("nome"),
    ]);
    const idsOnline = (presentes ?? []).map((p) => p.profile_id as string);
    const { data: nomesOnline } = idsOnline.length
      ? await sb.from("profiles").select("id, nome").in("id", idsOnline)
      : { data: [] as { id: string; nome: string }[] };
    return NextResponse.json({
      naoLidas: (conversas ?? []).reduce((s, c) => s + (c.nao_lidas ?? 0), 0),
      conversasNaoLidas: (conversas ?? []).length,
      online: (nomesOnline ?? []).map((p) => ({ id: p.id, nome: limparNome(p.nome ?? "") })),
      disponivel: minha ? minha.disponivel : auth.empresa === EMPRESA_DO_SITE,
      podeConfigurar: auth.cargo === "Gestor" || auth.cargo === "Diretor" || auth.gestorMestre,
      config: config ? { ...config, atalhos: limparAtalhos(config.atalhos), horario: limparHorario(config.horario) } : null,
      equipe: (equipe ?? []).map((p) => ({ id: p.id, nome: limparNome(p.nome ?? "") })),
    });
  }

  const id = url.searchParams.get("c") ?? "";
  const { data: conversa } = await sb
    .from("site_conversas")
    .select("id, empresa, envio_id, lead_id, nome, telefone, email, cidade, status, atendente_id, nao_lidas, ultima_em, visitante_visto_em, origem_url, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!conversa || conversa.empresa !== EMPRESA_DO_SITE) return NextResponse.json({ erro: "Conversa não encontrada." }, { status: 404 });

  const { data: mensagens } = await sb
    .from("site_mensagens")
    .select("id, autor, autor_id, autor_nome, texto, created_at")
    .eq("conversa_id", conversa.id)
    .order("created_at", { ascending: true })
    .limit(500);

  if (conversa.nao_lidas > 0) await sb.from("site_conversas").update({ nao_lidas: 0 }).eq("id", conversa.id);

  let atendente: string | null = null;
  if (conversa.atendente_id) {
    const { data: p } = await sb.from("profiles").select("nome").eq("id", conversa.atendente_id).maybeSingle();
    atendente = p?.nome ? limparNome(p.nome) : null;
  }

  return NextResponse.json({ conversa: { ...conversa, nao_lidas: 0, atendente }, mensagens: mensagens ?? [] });
}

export async function POST(request: Request) {
  const auth = await equipeDoSite(request);
  if (!auth) return NextResponse.json({ erro: "Só a equipe da MF usa esta área." }, { status: 403 });
  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Sistema indisponível." }, { status: 503 });

  let corpo: Record<string, unknown>;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  const acao = String(corpo.acao ?? "");

  if (acao === "presenca") {
    const { data: atual } = await sb.from("site_presenca").select("disponivel").eq("profile_id", auth.userId).maybeSingle();
    // Quem é da MF começa disponível; gestor mestre de outra loja começa fora,
    // para não aparecer no site da MF sem querer.
    const disponivel = typeof corpo.disponivel === "boolean" ? corpo.disponivel : atual ? atual.disponivel : auth.empresa === EMPRESA_DO_SITE;
    const { error } = await sb
      .from("site_presenca")
      .upsert({ profile_id: auth.userId, empresa: EMPRESA_DO_SITE, disponivel, visto_em: new Date().toISOString() });
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, disponivel });
  }

  if (acao === "config") {
    if (!(auth.cargo === "Gestor" || auth.cargo === "Diretor" || auth.gestorMestre)) {
      return NextResponse.json({ erro: "Só o gestor muda a configuração do chat." }, { status: 403 });
    }
    const saudacao = typeof corpo.saudacao === "string" ? corpo.saudacao.trim().slice(0, 300) : "";
    if (!saudacao) return NextResponse.json({ erro: "Escreva a saudação." }, { status: 400 });
    const whatsapp = typeof corpo.whatsapp === "string" ? corpo.whatsapp.replace(/\D/g, "").slice(0, 15) : "";
    const foraHorario = typeof corpo.mensagemForaHorario === "string" ? corpo.mensagemForaHorario.trim().slice(0, 300) : "";
    const { error } = await sb
      .from("site_chat_config")
      .upsert({
        empresa: EMPRESA_DO_SITE,
        ativo: corpo.ativo !== false,
        saudacao,
        atendente_padrao_id: typeof corpo.atendentePadraoId === "string" && corpo.atendentePadraoId ? corpo.atendentePadraoId : null,
        atalhos: limparAtalhos(corpo.atalhos),
        whatsapp: whatsapp || null,
        horario: limparHorario(corpo.horario),
        ...(foraHorario ? { mensagem_fora_horario: foraHorario } : {}),
        updated_at: new Date().toISOString(),
      });
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const id = String(corpo.c ?? "");
  const { data: conversa } = await sb.from("site_conversas").select("id, empresa, status, atendente_id").eq("id", id).maybeSingle();
  if (!conversa || conversa.empresa !== EMPRESA_DO_SITE) return NextResponse.json({ erro: "Conversa não encontrada." }, { status: 404 });

  const { data: eu } = await sb.from("profiles").select("nome").eq("id", auth.userId).maybeSingle();
  const meuNome = primeiroNome(limparNome(eu?.nome ?? ""));
  const agora = new Date().toISOString();

  if (acao === "responder") {
    const texto = typeof corpo.texto === "string" ? corpo.texto.trim().slice(0, 2000) : "";
    if (!texto) return NextResponse.json({ erro: "Escreva a mensagem." }, { status: 400 });
    const { data: msg, error } = await sb
      .from("site_mensagens")
      .insert({ conversa_id: conversa.id, autor: "equipe", autor_id: auth.userId, autor_nome: meuNome, texto })
      .select("id, autor, autor_id, autor_nome, texto, created_at")
      .single();
    if (error || !msg) return NextResponse.json({ erro: error?.message ?? "Não consegui enviar." }, { status: 500 });
    await sb
      .from("site_conversas")
      .update({
        atendente_id: conversa.atendente_id ?? auth.userId,
        nao_lidas: 0,
        ultima_mensagem: texto.slice(0, 200),
        ultima_em: agora,
        status: "aberta",
      })
      .eq("id", conversa.id);
    return NextResponse.json({ ok: true, mensagem: msg });
  }

  if (acao === "encerrar" || acao === "reabrir") {
    const status = acao === "encerrar" ? "encerrada" : "aberta";
    if (conversa.status !== status) {
      await sb.from("site_conversas").update({ status, nao_lidas: 0 }).eq("id", conversa.id);
      if (acao === "encerrar") {
        await sb.from("site_mensagens").insert({
          conversa_id: conversa.id,
          autor: "sistema",
          texto: "Atendimento encerrado. Se precisar de mais alguma coisa, é só escrever aqui ou chamar no WhatsApp.",
        });
      }
    }
    return NextResponse.json({ ok: true, status });
  }

  return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });
}
