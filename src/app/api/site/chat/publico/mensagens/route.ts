import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { atendenteDoWidget, conversaDoVisitante, fotosDosAutores, preflight, respostaCors } from "@/lib/site-mf/chat";
import { responderComAssistente } from "@/lib/site-mf/assistente";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return preflight();
}

const LIMITE_MENSAGENS = 15;
const JANELA_MENSAGENS_MS = 2 * 60 * 1000;

/**
 * GET: o widget pergunta, a cada poucos segundos, se chegou resposta.
 *      ?c=<conversa>&t=<segredo>&depois=<data da última que ele já tem>[&atendente=1]
 * POST: o visitante manda uma mensagem. { c, t, texto }
 */
export async function GET(request: Request) {
  const sb = getSupabaseServiceClient();
  if (!sb) return respostaCors({ erro: "Sistema indisponível." }, 503);
  const url = new URL(request.url);
  const conversa = await conversaDoVisitante(sb, url.searchParams.get("c"), url.searchParams.get("t"));
  if (!conversa) return respostaCors({ erro: "Conversa não encontrada." }, 404);

  // "Está no site agora", para a equipe. Grava no máximo a cada 20 s.
  const visto = conversa.visitante_visto_em ? new Date(conversa.visitante_visto_em).getTime() : 0;
  if (Date.now() - visto > 20_000) {
    await sb.from("site_conversas").update({ visitante_visto_em: new Date().toISOString() }).eq("id", conversa.id);
  }

  const depois = url.searchParams.get("depois");
  let q = sb
    .from("site_mensagens")
    .select("id, autor, autor_id, autor_nome, texto, anexo_url, anexo_tipo, anexo_nome, anexo_tamanho, created_at")
    .eq("conversa_id", conversa.id)
    .order("created_at", { ascending: true })
    .limit(200);
  if (depois && !Number.isNaN(Date.parse(depois))) q = q.gt("created_at", depois);
  const { data: brutas } = await q;
  // Foto de quem respondeu; o id de quem é da equipe não sai daqui.
  const fotos = await fotosDosAutores(sb, (brutas ?? []).map((m) => m.autor_id as string | null));
  const mensagens = (brutas ?? []).map(({ autor_id, ...m }) => ({ ...m, autor_foto: autor_id ? fotos.get(autor_id) ?? null : null }));

  // Quem atende muda pouco: o widget pede junto só de vez em quando (?atendente=1).
  const atendente = url.searchParams.get("atendente") === "1" ? await atendenteDoWidget(sb, conversa.empresa, conversa.atendente_id) : null;
  return respostaCors({ status: conversa.status, atendente: atendente ? { nome: atendente.nome, foto: atendente.foto } : null, mensagens });
}

export async function POST(request: Request) {
  const sb = getSupabaseServiceClient();
  if (!sb) return respostaCors({ ok: false, erro: "Sistema indisponível." }, 503);
  let corpo: Record<string, unknown>;
  try {
    corpo = await request.json();
  } catch {
    return respostaCors({ ok: false, erro: "Envio inválido." }, 400);
  }
  const conversa = await conversaDoVisitante(sb, corpo.c, corpo.t);
  if (!conversa) return respostaCors({ ok: false, erro: "Conversa não encontrada." }, 404);

  const texto = typeof corpo.texto === "string" ? corpo.texto.trim().slice(0, 1000) : "";
  if (!texto) return respostaCors({ ok: false, erro: "Escreva a mensagem." }, 400);

  const desde = new Date(Date.now() - JANELA_MENSAGENS_MS).toISOString();
  const { count } = await sb
    .from("site_mensagens")
    .select("id", { count: "exact", head: true })
    .eq("conversa_id", conversa.id)
    .eq("autor", "visitante")
    .gte("created_at", desde);
  if ((count ?? 0) >= LIMITE_MENSAGENS) {
    return respostaCors({ ok: false, erro: "Muitas mensagens seguidas. Aguarde um pouquinho." }, 429);
  }

  const { data: msg, error } = await sb
    .from("site_mensagens")
    .insert({ conversa_id: conversa.id, autor: "visitante", autor_nome: conversa.nome, texto })
    .select("id, autor, autor_nome, texto, anexo_url, anexo_tipo, anexo_nome, anexo_tamanho, created_at")
    .single();
  if (error || !msg) return respostaCors({ ok: false, erro: "Não consegui enviar. Tente de novo." }, 500);

  const agora = new Date().toISOString();
  await sb
    .from("site_conversas")
    .update({
      nao_lidas: (conversa.nao_lidas ?? 0) + 1,
      ultima_mensagem: texto.slice(0, 200),
      ultima_em: agora,
      visitante_visto_em: agora,
      // Cliente que volta a escrever reabre a conversa encerrada.
      status: "aberta",
    })
    .eq("id", conversa.id);

  // Fora do horário (ou sem ninguém online), o assistente responde.
  void responderComAssistente(sb, conversa.id).catch((e) => console.error("[chat] assistente:", e?.message ?? e));

  return respostaCors({ ok: true, mensagem: msg });
}
