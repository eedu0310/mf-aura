import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { EMPRESA_DO_SITE } from "@/lib/site-mf/tipos";
import { CONTATO_MF, atendenteDoWidget, conversaDoVisitante, limparAtalhos, preflight, respostaCors } from "@/lib/site-mf/chat";
import { dentroDoHorario, horarioEmTexto, limparHorario } from "@/lib/site-mf/horario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

/**
 * O que o widget do site mostra ao abrir: atendente, saudação, cor, atalhos
 * dos materiais e horário. Pública (o widget roda no site da MF, sem login).
 * Não devolve nada além do que aparece na tela do visitante.
 */
export async function GET(request: Request) {
  const sb = getSupabaseServiceClient();
  if (!sb) return respostaCors({ ativo: false }, 503);

  const url = new URL(request.url);
  const conversa = await conversaDoVisitante(sb, url.searchParams.get("c"), url.searchParams.get("t"));

  const { data: config } = await sb
    .from("site_chat_config")
    .select("ativo, saudacao, cor, atalhos, whatsapp, horario, mensagem_fora_horario")
    .eq("empresa", EMPRESA_DO_SITE)
    .maybeSingle();
  if (!config || !config.ativo) return respostaCors({ ativo: false });

  // Só os atalhos de formulário que ainda estão ativos.
  const atalhos = limparAtalhos(config.atalhos);
  let ativos = new Set<string>();
  if (atalhos.length) {
    const { data: forms } = await sb
      .from("site_formularios")
      .select("slug")
      .in("slug", atalhos.map((a) => a.slug))
      .eq("ativo", true);
    ativos = new Set((forms ?? []).map((f) => f.slug as string));
  }

  const horario = limparHorario(config.horario);
  const atendente = await atendenteDoWidget(sb, EMPRESA_DO_SITE, conversa?.atendente_id);

  return respostaCors({
    ativo: true,
    empresa: "MF International",
    cor: config.cor,
    saudacao: config.saudacao,
    atendente: { nome: atendente.nome, alguemOnline: atendente.online },
    atalhos: atalhos.filter((a) => ativos.has(a.slug)),
    whatsapp: config.whatsapp || CONTATO_MF.whatsapp,
    contato: CONTATO_MF,
    horario: {
      texto: horarioEmTexto(horario),
      aberto: dentroDoHorario(horario),
      mensagemFora: config.mensagem_fora_horario,
    },
    conversa: conversa ? { status: conversa.status } : null,
  });
}
