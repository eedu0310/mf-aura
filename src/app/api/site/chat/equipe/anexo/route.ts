import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { equipeDoSite, primeiroNome } from "@/lib/site-mf/servidor";
import { EMPRESA_DO_SITE } from "@/lib/site-mf/tipos";
import { limparNome, resumoDoAnexo, salvarAnexo } from "@/lib/site-mf/chat";

export const runtime = "nodejs";

/** A equipe manda um arquivo no chat do site. FormData: c, arquivo, texto (opcional). */
export async function POST(request: Request) {
  const auth = await equipeDoSite(request);
  if (!auth) return NextResponse.json({ erro: "Só a equipe da MF usa esta área." }, { status: 403 });
  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Sistema indisponível." }, { status: 503 });
  const form = await request.formData().catch(() => null);
  const id = String(form?.get("c") ?? "");
  const arquivo = form?.get("arquivo");
  if (!(arquivo instanceof File)) return NextResponse.json({ erro: "Escolha um arquivo." }, { status: 400 });

  const { data: conversa } = await sb.from("site_conversas").select("id, empresa, atendente_id").eq("id", id).maybeSingle();
  if (!conversa || conversa.empresa !== EMPRESA_DO_SITE) return NextResponse.json({ erro: "Conversa não encontrada." }, { status: 404 });

  const anexo = await salvarAnexo(sb, conversa.id, arquivo);
  if ("erro" in anexo) return NextResponse.json({ erro: anexo.erro }, { status: 400 });
  const texto = typeof form?.get("texto") === "string" ? String(form?.get("texto")).trim().slice(0, 2000) : "";

  const { data: eu } = await sb.from("profiles").select("nome").eq("id", auth.userId).maybeSingle();
  const { data: msg, error } = await sb
    .from("site_mensagens")
    .insert({ conversa_id: conversa.id, autor: "equipe", autor_id: auth.userId, autor_nome: primeiroNome(limparNome(eu?.nome ?? "")), texto, ...anexo })
    .select("id, autor, autor_id, autor_nome, texto, anexo_url, anexo_tipo, anexo_nome, anexo_tamanho, created_at")
    .single();
  if (error || !msg) return NextResponse.json({ erro: error?.message ?? "Não consegui enviar." }, { status: 500 });

  await sb
    .from("site_conversas")
    .update({ atendente_id: conversa.atendente_id ?? auth.userId, nao_lidas: 0, ultima_mensagem: texto || resumoDoAnexo(anexo), ultima_em: new Date().toISOString(), status: "aberta" })
    .eq("id", conversa.id);
  return NextResponse.json({ ok: true, mensagem: msg });
}
