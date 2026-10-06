import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
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
  marcarNaoLida,
  reagir,
  encaminhar,
} from "@/lib/whatsapp/live-manager";
import {
  agendarAnalise,
  alertasDoChat,
  definirEtapaManual,
  iaDisponivel,
  listarLeads,
  classificarContato,
  marcarIgnorado,
  marcarLeadRespondidoPorTelefone,
  obterLead,
} from "@/lib/whatsapp/supervisor";
import { calcularAlertas } from "@/lib/whatsapp/stage-rules";
import { nomesDasEtapas, type Etapa } from "@/lib/funil";
import { carregarFunil } from "@/lib/funil-servidor";
import {
  ehCategoria,
  ehNatureza,
  type CategoriaContato,
  type NaturezaContato,
} from "@/lib/categoria-contato";
import { paraVozOpus } from "@/lib/whatsapp/voz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 60 * 1024 * 1024;

async function currentUserId(): Promise<string | null> {
  // O proxy já validou a sessão nesta requisição e deixou o id no cabeçalho.
  // Perguntar de novo ao Supabase custava uma ida à rede em cada pedido — e
  // esta tela faz três por segundo com uma conversa aberta.
  const doProxy = (await headers()).get("x-aura-usuario");
  if (doProxy) return doProxy;

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
  /**
   * O funil vai junto com o estado: a tela do WhatsApp desenha os botões de
   * etapa, e com a lista fixa no código ela mostraria etapas que a loja
   * renomeou ou desligou — e o botão não teria para onde mover o card.
   */
  const sbFunil = await getSupabaseServerClient();
  const { data: meuPerfil } = sbFunil
    ? await sbFunil.from("profiles").select("empresa").eq("id", userId).maybeSingle()
    : { data: null };
  const funil = await carregarFunil(sbFunil, meuPerfil?.empresa);

  return NextResponse.json({ userId, ...state, leads, alertas, funil, iaDisponivel: iaDisponivel() });
}

/**
 * POST JSON { action: "connect" | "send" | "read" | "logout" | "analyze" | "ignore" | "stage", ... }
 * POST multipart (file, to, caption, quotedId?, ptt?) → foto, vídeo,
 *   documento ou mensagem de voz, respondendo uma mensagem se quiser
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
      const quotedId = String(form.get("quotedId") ?? "").trim() || null;
      const ehVoz = String(form.get("ptt") ?? "") === "1";
      if (!(file instanceof File) || !to) {
        return NextResponse.json({ error: "Arquivo ou destinatário ausente." }, { status: 400 });
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: "Arquivo muito grande (máx. 60 MB)." }, { status: 413 });
      }
      let buffer: Buffer = Buffer.from(await file.arrayBuffer());
      let mimetype = file.type || "application/octet-stream";
      if (ehVoz) {
        // O navegador grava Opus em WebM; a bolinha de voz do WhatsApp exige
        // Opus em OGG. Se o servidor nao converter, o vendedor recebe o
        // motivo em vez de o cliente receber um audio que nao toca.
        try {
          buffer = await paraVozOpus(buffer, mimetype);
          mimetype = "audio/ogg; codecs=opus";
        } catch (e: any) {
          return NextResponse.json({ error: e?.message ?? "Não consegui preparar o áudio." }, { status: 422 });
        }
      }
      const result = await sendFile(
        userId,
        to,
        { buffer, mimetype, fileName: file.name || "arquivo" },
        caption,
        { quotedId, ptt: ehVoz },
      );
      void fecharLeadDoContato(userId, to);
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
        const result = await sendText(userId, to, text, String(body.quotedId ?? "").trim() || null);
        // Respondeu pelo WhatsApp: fecha o lead correspondente, zera o alerta
        // de "sem resposta" do gestor e joga o negócio no pipeline.
        void fecharLeadDoContato(userId, to);
        return NextResponse.json({ ok: true, ...result });
      }
      case "read": {
        if (body.chat) markRead(userId, String(body.chat));
        return NextResponse.json({ ok: true });
      }
      /** Marcar como nao lida, como no WhatsApp Business. */
      case "unread": {
        if (!body.chat) return NextResponse.json({ error: "Conversa ausente." }, { status: 400 });
        const r = await marcarNaoLida(userId, String(body.chat));
        return NextResponse.json({ ok: true, ...r });
      }

      /**
       * Reagir com emoji. Emoji vazio desfaz, que e como o proprio WhatsApp
       * trata: tirar a reacao e reagir com nada.
       */
      case "react": {
        const chat = String(body.chat ?? "").trim();
        const msgId = String(body.msgId ?? "").trim();
        if (!chat || !msgId) {
          return NextResponse.json({ error: "Informe a conversa e a mensagem." }, { status: 400 });
        }
        // Limite curto de proposito: reacao e um emoji, nao um recado.
        const emoji = String(body.emoji ?? "").slice(0, 8);
        await reagir(userId, chat, msgId, emoji);
        return NextResponse.json({ ok: true });
      }

      /** Encaminhar mensagem, foto ou documento para outras conversas. */
      case "forward": {
        const de = String(body.chat ?? "").trim();
        const msgId = String(body.msgId ?? "").trim();
        const para = Array.isArray(body.para) ? body.para.map((p: unknown) => String(p)).filter(Boolean) : [];
        if (!de || !msgId || para.length === 0) {
          return NextResponse.json(
            { error: "Informe a conversa, a mensagem e para quem encaminhar." },
            { status: 400 },
          );
        }
        if (para.length > 10) {
          // O mesmo teto do WhatsApp: acima disso vira disparo em massa, que
          // derruba o numero.
          return NextResponse.json({ error: "No máximo 10 conversas por vez." }, { status: 400 });
        }
        const r = await encaminhar(userId, de, msgId, para);
        return NextResponse.json({ ok: true, ...r });
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
      /**
       * O vendedor diz o que o contato e: lead, nao-lead ou cliente da casa,
       * e de que categoria (Arquiteto, Construtora, Cliente Final...).
       *
       * Os dois eixos sao independentes e podem vir juntos ou separados: dar
       * categoria a quem ainda nao foi classificado nao deve classificar, e
       * marcar natureza nao deve apagar a categoria. Por isso cada campo so
       * viaja quando esta presente no corpo.
       */
      case "classify": {
        if (!body.chat) return NextResponse.json({ error: "Conversa ausente." }, { status: 400 });

        const entrada: {
          natureza?: NaturezaContato | null;
          categoria?: CategoriaContato | null;
          motivo?: string | null;
        } = {};

        if ("natureza" in body) {
          if (body.natureza !== null && !ehNatureza(body.natureza)) {
            return NextResponse.json({ error: "Natureza inválida." }, { status: 400 });
          }
          entrada.natureza = body.natureza;
        }
        if ("categoria" in body) {
          if (body.categoria !== null && !ehCategoria(body.categoria)) {
            return NextResponse.json({ error: "Categoria inválida." }, { status: 400 });
          }
          entrada.categoria = body.categoria;
        }
        if ("motivo" in body) {
          entrada.motivo = body.motivo ? String(body.motivo).slice(0, 80) : null;
        }
        if (Object.keys(entrada).length === 0) {
          return NextResponse.json({ error: "Nada para classificar." }, { status: 400 });
        }

        await classificarContato(userId, String(body.chat), entrada);
        return NextResponse.json({ ok: true });
      }
      case "stage": {
        const etapa = String(body.etapa ?? "") as Etapa;
        // A etapa válida é a do funil DESTA loja, não mais uma lista fixa no
        // código: o gestor edita as etapas e o que vale é o que ele gravou.
        const sbEtapa = await getSupabaseServerClient();
        const { data: meu } = sbEtapa
          ? await sbEtapa.from("profiles").select("empresa").eq("id", userId).maybeSingle()
          : { data: null };
        const funilDaLoja = await carregarFunil(sbEtapa, meu?.empresa);
        if (!body.chat || !nomesDasEtapas(funilDaLoja).includes(etapa)) {
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
