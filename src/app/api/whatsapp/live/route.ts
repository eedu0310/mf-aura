import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  getState,
  getMessages,
  logout,
  markRead,
  sendText,
  startSession,
} from "@/lib/whatsapp/live-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function currentUserId(): Promise<string | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return "demo";
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** GET → estado da conexão + lista de conversas. ?chat=<id> → mensagens da conversa. */
export async function GET(request: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Faça login novamente." }, { status: 401 });

  const chat = request.nextUrl.searchParams.get("chat");
  if (chat) {
    return NextResponse.json({ messages: getMessages(userId, chat) });
  }
  return NextResponse.json({ userId, ...(await getState(userId)) });
}

/** POST { action: "connect" | "send" | "read" | "logout", ... } */
export async function POST(request: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Faça login novamente." }, { status: 401 });

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    switch (body.action) {
      case "connect": {
        await startSession(userId);
        return NextResponse.json(await getState(userId));
      }
      case "send": {
        const to = String(body.to ?? "").trim();
        const text = String(body.text ?? "").trim();
        if (!to || !text) {
          return NextResponse.json({ error: "Informe o destinatário e a mensagem." }, { status: 400 });
        }
        const result = await sendText(userId, to, text);
        return NextResponse.json({ ok: true, ...result });
      }
      case "read": {
        if (body.chat) markRead(userId, String(body.chat));
        return NextResponse.json({ ok: true });
      }
      case "logout": {
        await logout(userId);
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    }
  } catch (e: any) {
    console.error("[api/whatsapp/live]", e);
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}
