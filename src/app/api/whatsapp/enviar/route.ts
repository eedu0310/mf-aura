import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { enviarMensagemWhatsApp } from "@/lib/whatsapp";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { conversaId, texto } = await request.json();
  if (!conversaId || !texto?.trim()) {
    return NextResponse.json({ erro: "Parâmetros ausentes." }, { status: 400 });
  }

  const { data: conversa, error: erroConversa } = await auth.supabase
    .from("whatsapp_conversas")
    .select("id, telefone, phone_number_id, atendente_id, status")
    .eq("id", conversaId)
    .single();

  if (erroConversa || !conversa) {
    return NextResponse.json({ erro: "Conversa não encontrada." }, { status: 404 });
  }
  if (conversa.atendente_id !== auth.userId && !["Gestor", "Diretor"].includes(auth.cargo)) {
    return NextResponse.json({ erro: "Você precisa aceitar essa conversa antes de responder." }, { status: 403 });
  }

  const enviado = await enviarMensagemWhatsApp(conversa.phone_number_id, conversa.telefone, texto.trim());
  if (!enviado) {
    return NextResponse.json({ erro: "Não consegui enviar pelo WhatsApp. Tente novamente." }, { status: 500 });
  }

  const { error: erroInsert } = await auth.supabase.from("whatsapp_mensagens").insert({
    conversa_id: conversaId,
    remetente: "atendente",
    texto: texto.trim(),
    enviado_por: auth.userId,
  });

  if (erroInsert) {
    console.error("Erro ao salvar mensagem enviada:", erroInsert);
    return NextResponse.json({ erro: "Mensagem foi pro WhatsApp, mas não salvou no histórico." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
