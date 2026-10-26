import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { conversaDoVisitante, preflight, respostaCors, resumoDoAnexo, salvarAnexo } from "@/lib/site-mf/chat";
import { responderComAssistente } from "@/lib/site-mf/assistente";

export const runtime = "nodejs";

export function OPTIONS() {
  return preflight();
}

/** Arquivos por conversa a cada 10 minutos (foto, documento, áudio). */
const LIMITE = 10;

/**
 * O visitante manda um arquivo no chat do site (foto, documento, áudio
 * gravado no widget). FormData: c, t, arquivo, texto (opcional).
 */
export async function POST(request: Request) {
  const sb = getSupabaseServiceClient();
  if (!sb) return respostaCors({ ok: false, erro: "Sistema indisponível." }, 503);
  const form = await request.formData().catch(() => null);
  if (!form) return respostaCors({ ok: false, erro: "Envio inválido." }, 400);
  const conversa = await conversaDoVisitante(sb, form.get("c"), form.get("t"));
  if (!conversa) return respostaCors({ ok: false, erro: "Conversa não encontrada." }, 404);
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File)) return respostaCors({ ok: false, erro: "Escolha um arquivo." }, 400);

  const desde = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await sb
    .from("site_mensagens")
    .select("id", { count: "exact", head: true })
    .eq("conversa_id", conversa.id)
    .eq("autor", "visitante")
    .not("anexo_url", "is", null)
    .gte("created_at", desde);
  if ((count ?? 0) >= LIMITE) return respostaCors({ ok: false, erro: "Muitos arquivos seguidos. Aguarde um pouquinho." }, 429);

  const anexo = await salvarAnexo(sb, conversa.id, arquivo);
  if ("erro" in anexo) return respostaCors({ ok: false, erro: anexo.erro }, 400);
  const texto = typeof form.get("texto") === "string" ? String(form.get("texto")).trim().slice(0, 1000) : "";

  const { data: msg, error } = await sb
    .from("site_mensagens")
    .insert({ conversa_id: conversa.id, autor: "visitante", autor_nome: conversa.nome, texto, ...anexo })
    .select("id, autor, autor_nome, texto, anexo_url, anexo_tipo, anexo_nome, anexo_tamanho, created_at")
    .single();
  if (error || !msg) return respostaCors({ ok: false, erro: "Não consegui enviar. Tente de novo." }, 500);

  const agora = new Date().toISOString();
  await sb
    .from("site_conversas")
    .update({ nao_lidas: (conversa.nao_lidas ?? 0) + 1, ultima_mensagem: texto || resumoDoAnexo(anexo), ultima_em: agora, visitante_visto_em: agora, status: "aberta" })
    .eq("id", conversa.id);

  void responderComAssistente(sb, conversa.id).catch((e) => console.error("[chat] assistente:", e?.message ?? e));
  return respostaCors({ ok: true, mensagem: msg });
}
