import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { EMPRESA_DO_SITE } from "@/lib/site-mf/tipos";
import { abrirLeadDoSite, hashDoSegredo, impressaoDoIp, novoSegredo, primeiroNome, soDigitos, telefoneDoSite } from "@/lib/site-mf/servidor";
import { atendenteDoWidget, avisarEquipe, preflight, respostaCors } from "@/lib/site-mf/chat";
import { dentroDoHorario, limparHorario } from "@/lib/site-mf/horario";
import { responderComAssistente } from "@/lib/site-mf/assistente";

export const runtime = "nodejs";

export function OPTIONS() {
  return preflight();
}

const LIMITE_POR_JANELA = 5;
const JANELA_MS = 10 * 60 * 1000;

function texto(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/**
 * Visitante começa uma conversa no widget do site.
 *
 * Vira, de uma vez: lead da MF (mesmo caminho do formulário: distribuição,
 * prazo, pipeline), envio do site (aparece em Site MF → Atendimento) e a
 * conversa em si. Devolve o segredo que o navegador do visitante guarda
 * para continuar a conversa.
 */
export async function POST(request: Request) {
  let corpo: Record<string, unknown>;
  try {
    corpo = await request.json();
  } catch {
    return respostaCors({ ok: false, erro: "Envio inválido." }, 400);
  }
  // Armadilha de robô: campo escondido que gente não preenche.
  if (corpo.site) return respostaCors({ ok: false, erro: "Envio inválido." }, 400);

  const sb = getSupabaseServiceClient();
  if (!sb) return respostaCors({ ok: false, erro: "Sistema indisponível agora. Tente de novo em instantes." }, 503);

  const nome = texto(corpo.nome, 80);
  const telefone = telefoneDoSite(texto(corpo.telefone, 30));
  const emailBruto = texto(corpo.email, 120).toLowerCase();
  const cidade = texto(corpo.cidade, 80);
  const mensagem = texto(corpo.mensagem, 1000);

  if (!nome) return respostaCors({ ok: false, erro: "Diga o seu nome." }, 400);
  if (!telefone || soDigitos(telefone).length < 12) return respostaCors({ ok: false, erro: "Confira o WhatsApp com DDD." }, 400);
  if (emailBruto && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailBruto)) return respostaCors({ ok: false, erro: "Confira o e-mail." }, 400);
  if (!cidade) return respostaCors({ ok: false, erro: "Diga a sua cidade." }, 400);
  const email = emailBruto || null;

  const ip = impressaoDoIp(request);
  if (ip) {
    const desde = new Date(Date.now() - JANELA_MS).toISOString();
    const { count } = await sb.from("site_envios").select("id", { count: "exact", head: true }).eq("ip_hash", ip).gte("created_at", desde);
    if ((count ?? 0) >= LIMITE_POR_JANELA) {
      return respostaCors({ ok: false, erro: "Recebemos vários contatos seguidos daqui. Aguarde alguns minutos." }, 429);
    }
  }

  const origemUrl = texto(corpo.origem_url, 500) || null;
  const utm = corpo.utm && typeof corpo.utm === "object" ? (corpo.utm as Record<string, string>) : null;

  const lead = await abrirLeadDoSite(sb, {
    empresa: EMPRESA_DO_SITE,
    nome,
    telefone,
    email,
    mensagem: `Chat do site da MF\nNome: ${nome}\nCidade: ${cidade}${email ? `\nE-mail: ${email}` : ""}${mensagem ? `\nMensagem: ${mensagem}` : ""}`,
    origem: "Site MF · Chat do site",
  });
  if (!lead.id) {
    console.error("[chat] criar lead:", lead.erro);
    return respostaCors({ ok: false, erro: "Não consegui começar agora. Tente de novo em instantes." }, 500);
  }

  const { data: envio, error: erroEnvio } = await sb
    .from("site_envios")
    .insert({
      empresa: EMPRESA_DO_SITE,
      formulario_id: null,
      dados: { canal: "chat", nome, whatsapp: telefone, ...(email ? { email } : {}), cidade, ...(mensagem ? { mensagem } : {}) },
      nome,
      telefone,
      email,
      cidade,
      origem_url: origemUrl,
      utm,
      lead_id: lead.id,
      ip_hash: ip,
    })
    .select("id")
    .single();
  if (erroEnvio) console.error("[chat] gravar envio:", erroEnvio.message);

  const segredo = novoSegredo();
  const atendente = await atendenteDoWidget(sb, EMPRESA_DO_SITE);
  const agora = new Date().toISOString();
  const { data: conversa, error: erroConversa } = await sb
    .from("site_conversas")
    .insert({
      empresa: EMPRESA_DO_SITE,
      envio_id: envio?.id ?? null,
      lead_id: lead.id,
      token_hash: hashDoSegredo(segredo),
      nome,
      telefone,
      email,
      cidade,
      nao_lidas: mensagem ? 1 : 0,
      ultima_mensagem: mensagem || "Começou uma conversa",
      ultima_em: agora,
      visitante_visto_em: agora,
      origem_url: origemUrl,
      ip_hash: ip,
    })
    .select("id")
    .single();
  if (erroConversa || !conversa) {
    console.error("[chat] criar conversa:", erroConversa?.message);
    return respostaCors({ ok: false, erro: "Não consegui começar agora. Tente de novo em instantes." }, 500);
  }

  const { data: config } = await sb.from("site_chat_config").select("horario, mensagem_fora_horario").eq("empresa", EMPRESA_DO_SITE).maybeSingle();
  const aberto = dentroDoHorario(limparHorario(config?.horario));
  const primeiras = [
    {
      conversa_id: conversa.id,
      autor: "sistema",
      texto: aberto
        ? `Oi, ${primeiroNome(nome)}! Recebemos o seu contato. ${primeiroNome(atendente.nome)} vai te responder por aqui em instantes.`
        : `Oi, ${primeiroNome(nome)}! Recebemos o seu contato. ${config?.mensagem_fora_horario ?? "A equipe responde assim que voltar."}`,
    },
    ...(mensagem ? [{ conversa_id: conversa.id, autor: "visitante", autor_nome: nome, texto: mensagem }] : []),
  ];
  const { error: erroMsg } = await sb.from("site_mensagens").insert(primeiras);
  if (erroMsg) console.error("[chat] primeiras mensagens:", erroMsg.message);

  // Avisa quem está online, o atendente padrão e o dono do lead.
  const { data: dono } = await sb.from("leads_recebidos").select("vendedor_id, sdr_id").eq("id", lead.id).maybeSingle();
  const desde = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  const { data: online } = await sb
    .from("site_presenca")
    .select("profile_id")
    .eq("empresa", EMPRESA_DO_SITE)
    .eq("disponivel", true)
    .gte("visto_em", desde);
  await avisarEquipe(
    sb,
    EMPRESA_DO_SITE,
    [atendente.id, dono?.vendedor_id, dono?.sdr_id, ...(online ?? []).map((o) => o.profile_id as string)],
    "Novo chat no site da MF",
    `${nome} (${cidade}) começou uma conversa no site.${mensagem ? ` "${mensagem}"` : ""}`,
  );

  // Fora do horário, o assistente já puxa a conversa.
  if (mensagem) void responderComAssistente(sb, conversa.id).catch((e) => console.error("[chat] assistente:", e?.message ?? e));

  return respostaCors({ ok: true, conversa: conversa.id, token: segredo });
}
