import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  getAvatar,
  getMedia,
  getMessages,
  getState,
  loadOlder,
  logout,
  markRead,
  sendFile,
  sendText,
  startSession,
} from "@/lib/whatsapp/live-manager";
import {
  agendarAnalise,
  alertasDoChat,
  definirEtapaManual,
  iaDisponivel,
  listarLeads,
  marcarIgnorado,
  marcarLeadRespondidoPorTelefone,
  obterLead,
} from "@/lib/whatsapp/supervisor";
import { calcularAlertas, ETAPAS, type Etapa } from "@/lib/whatsapp/stage-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 60 * 1024 * 1024;

async function currentUserId(): Promise<string | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return "demo";
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

const unauthorized = () => NextResponse.json({ error: "Faça login novamente." }, { status: 401 });

/**
 * GET                → estado da conexão, conversas, leads e alertas
 * GET ?chat=<jid>    → mensagens + alertas da conversa
 * GET ?lead=<jid>    → análise do Supervisor AURA para a conversa
 * GET ?avatar=<jid>  → { url } da foto de perfil (null se não houver)
 * GET ?media=<id>    → arquivo da mensagem (foto, vídeo, áudio, documento)
 */
export async function GET(request: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  const sp = request.nextUrl.searchParams;

  const avatar = sp.get("avatar");
  if (avatar) {
    // JSON (e não redirect/404) para não sujar o console quando o contato não tem foto.
    const url = await getAvatar(userId, avatar);
    return NextResponse.json({ url }, { headers: { "Cache-Control": "private, max-age=1800" } });
  }

  const media = sp.get("media");
  if (media) {
    try {
      const file = await getMedia(userId, media);
      if (!file) return NextResponse.json({ error: "Arquivo não disponível." }, { status: 404 });
      const headers: Record<string, string> = {
        "Content-Type": file.mimetype,
        "Cache-Control": "private, max-age=86400",
      };
      if (file.fileName) {
        const disp = sp.get("download") ? "attachment" : "inline";
        headers["Content-Disposition"] = `${disp}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`;
      }
      return new NextResponse(new Uint8Array(file.buffer), { headers });
    } catch (e: any) {
      console.error("[api/whatsapp/live] media:", e?.message ?? e);
      return NextResponse.json({ error: "Não foi possível baixar o arquivo." }, { status: 404 });
    }
  }

  const chat = sp.get("chat");
  if (chat) {
    return NextResponse.json({ messages: getMessages(userId, chat), alertas: alertasDoChat(userId, chat) });
  }

  const lead = sp.get("lead");
  if (lead) {
    const info = await obterLead(userId, lead);
    // Primeira vez que abre a conversa: pede uma análise.
    if (!info.ultimaAnaliseEm && !info.ignorado && !info.analisando && getMessages(userId, lead).length > 0) {
      agendarAnalise(userId, lead, 0);
      info.analisando = true;
    }
    return NextResponse.json(info);
  }

  const state = await getState(userId);
  const leads = await listarLeads(userId);
  const alertas: Record<string, ReturnType<typeof calcularAlertas>> = {};
  for (const c of state.chats) {
    const info = leads[c.id];
    if (info?.lead && !info.ignorado) {
      const a = calcularAlertas(getMessages(userId, c.id));
      if (a.length) alertas[c.id] = a;
    }
  }
  return NextResponse.json({ userId, ...state, leads, alertas, iaDisponivel: iaDisponivel() });
}

/**
 * POST JSON { action: "connect" | "send" | "read" | "logout" | "analyze" | "ignore" | "stage", ... }
 * POST multipart (file, to, caption) → envia foto/vídeo/documento
 */
/** Marca como respondido o lead do número para quem o vendedor escreveu. */
async function fecharLeadDoContato(userId: string, jid: string) {
  try {
    const supabase = await getSupabaseServerClient();
    if (!supabase) return;
    const { data: perfil } = await supabase
      .from("profiles")
      .select("empresa")
      .eq("id", userId)
      .maybeSingle();
    if (!perfil?.empresa) return;
    const telefone = jid.split("@")[0]?.split(":")[0] ?? "";
    if (!telefone) return;
    await marcarLeadRespondidoPorTelefone(supabase, perfil.empresa, telefone, userId);
  } catch (e: any) {
    console.error("[whatsapp] fechar lead do contato:", e?.message ?? e);
  }
}

export async function POST(request: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  try {
    if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const to = String(form.get("to") ?? "").trim();
      const caption = String(form.get("caption") ?? "").trim() || undefined;
      if (!(file instanceof File) || !to) {
        return NextResponse.json({ error: "Arquivo ou destinatário ausente." }, { status: 400 });
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: "Arquivo muito grande (máx. 60 MB)." }, { status: 413 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await sendFile(
        userId,
        to,
        { buffer, mimetype: file.type || "application/octet-stream", fileName: file.name || "arquivo" },
        caption,
      );
      return NextResponse.json({ ok: true, ...result });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    switch (body.action) {
      case "connect": {
        await startSession(userId, true);
        return NextResponse.json(await getState(userId));
      }
      case "send": {
        const to = String(body.to ?? "").trim();
        const text = String(body.text ?? "").trim();
        if (!to || !text) {
          return NextResponse.json({ error: "Informe o destinatário e a mensagem." }, { status: 400 });
        }
        const result = await sendText(userId, to, text);
        // Respondeu pelo WhatsApp: fecha o lead correspondente, zera o alerta
        // de "sem resposta" do gestor e joga o negócio no pipeline.
        void fecharLeadDoContato(userId, to);
        return NextResponse.json({ ok: true, ...result });
      }
      case "read": {
        if (body.chat) markRead(userId, String(body.chat));
        return NextResponse.json({ ok: true });
      }
      case "older": {
        if (!body.chat) return NextResponse.json({ error: "Conversa ausente." }, { status: 400 });
        await loadOlder(userId, String(body.chat));
        return NextResponse.json({ ok: true });
      }
      case "logout": {
        await logout(userId);
        return NextResponse.json({ ok: true });
      }
      case "analyze": {
        if (!body.chat) return NextResponse.json({ error: "Conversa ausente." }, { status: 400 });
        agendarAnalise(userId, String(body.chat), 0, { forcar: true, comoLead: !!body.comoLead });
        return NextResponse.json({ ok: true });
      }
      case "ignore": {
        if (!body.chat) return NextResponse.json({ error: "Conversa ausente." }, { status: 400 });
        await marcarIgnorado(userId, String(body.chat), body.ignorado !== false);
        return NextResponse.json({ ok: true });
      }
      case "stage": {
        const etapa = String(body.etapa ?? "") as Etapa;
        if (!body.chat || !ETAPAS.includes(etapa)) {
          return NextResponse.json({ error: "Etapa inválida." }, { status: 400 });
        }
        await definirEtapaManual(userId, String(body.chat), etapa);
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
