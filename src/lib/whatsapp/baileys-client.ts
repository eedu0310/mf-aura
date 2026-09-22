import path from "node:path";
import { rm } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const STATUS_ID = 1;
const STATUS_TABLE = "whatsapp_status";
const CONVERSATIONS_TABLE = "whatsapp_conversas";
const MESSAGES_TABLE = "whatsapp_mensagens";
const CONTACTS_TABLE = "whatsapp_contactos";
const DEFAULT_COMPANY = "aura-sales-os";

type Operation = { sucesso: boolean; mensagem?: string; erro?: string };
type Runtime = {
  sock: any | null;
  starting: Promise<Operation> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  connected: boolean;
  qrCode: string | null;
  lastError: string | null;
  stopping: boolean;
  fullHistoryAfterPairing: boolean;
  syncHistoryNext: boolean;
  credentialsSave: Promise<void>;
  contacts: Map<string, string>;
  avatars: Map<string, string | null>;
};

declare global {
  var __auraWhatsAppRuntime: Runtime | undefined;
  var __auraWhatsAppAdmin: SupabaseClient | undefined;
}

function runtime(): Runtime {
  globalThis.__auraWhatsAppRuntime ??= {
    sock: null,
    starting: null,
    reconnectTimer: null,
    connected: false,
    qrCode: null,
    lastError: null,
    stopping: false,
    fullHistoryAfterPairing: false,
    syncHistoryNext: false,
    credentialsSave: Promise.resolve(),
    contacts: new Map(),
    avatars: new Map(),
  };
  return globalThis.__auraWhatsAppRuntime;
}

function admin(): SupabaseClient {
  if (globalThis.__auraWhatsAppAdmin) return globalThis.__auraWhatsAppAdmin;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local e reinicie o Next.js.",
    );
  }
  globalThis.__auraWhatsAppAdmin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return globalThis.__auraWhatsAppAdmin;
}

function authDir() {
  return path.resolve(
    process.env.WHATSAPP_AUTH_DIR ||
      path.join(process.cwd(), ".data", "whatsapp-auth"),
  );
}

function digits(value?: string | null) {
  if (!value) return null;
  const result = value.split(":")[0].split("@")[0].replace(/\D/g, "");
  return result || null;
}

function activeLine(socket = runtime().sock) {
  return digits(socket?.user?.id);
}

async function avatarFor(phone: string, line: string, socket = runtime().sock) {
  const cacheKey = `${line}:${phone}`;
  if (runtime().avatars.has(cacheKey))
    return runtime().avatars.get(cacheKey) || null;
  try {
    const url = socket?.profilePictureUrl
      ? await socket.profilePictureUrl(`${phone}@s.whatsapp.net`, "image")
      : null;
    runtime().avatars.set(cacheKey, url || null);
    return url || null;
  } catch {
    runtime().avatars.set(cacheKey, null);
    return null;
  }
}

function company() {
  return process.env.WHATSAPP_EMPRESA?.trim() || DEFAULT_COMPANY;
}

function textOf(message: any): string {
  if (!message) return "";
  if (message.ephemeralMessage?.message)
    return textOf(message.ephemeralMessage.message);
  if (message.viewOnceMessage?.message)
    return textOf(message.viewOnceMessage.message);
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    message.buttonsResponseMessage?.selectedDisplayText ||
    message.listResponseMessage?.title ||
    ""
  );
}

function preview(message: any) {
  const text = textOf(message).trim();
  if (text) return text;
  if (message?.imageMessage) return "Imagem";
  if (message?.videoMessage) return "Vídeo";
  if (message?.audioMessage) return "Áudio";
  if (message?.documentMessage) return "Documento";
  if (message?.stickerMessage) return "Sticker";
  if (message?.locationMessage) return "Localização";
  if (message?.contactMessage || message?.contactsArrayMessage)
    return "Contacto";
  return "Mensagem recebida";
}

function iso(timestamp: unknown) {
  const value = Number(timestamp);
  if (!Number.isFinite(value) || value <= 0) return new Date().toISOString();
  return new Date(value > 1e12 ? value : value * 1000).toISOString();
}

function messageId(key: any) {
  return key?.remoteJid && key?.id ? `${key.remoteJid}:${key.id}` : null;
}

function nameOf(value: any) {
  const name =
    value?.name ||
    value?.notify ||
    value?.verifiedName ||
    value?.short ||
    value?.vname;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

async function status(
  connected: boolean,
  number: string | null,
  qr: string | null,
  error?: string | null,
) {
  const { error: dbError } = await admin()
    .from(STATUS_TABLE)
    .upsert(
      {
        id: STATUS_ID,
        conectado: connected,
        numero: number,
        qr_code: connected ? null : qr,
        ultimo_erro: error || null,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  if (dbError)
    console.error("[WhatsApp] erro ao guardar status:", dbError.message);
}

async function deleteConversationData(line: string | null) {
  if (!line) return;
  const db = admin();
  const { data, error } = await db
    .from(CONVERSATIONS_TABLE)
    .select("id")
    .eq("phone_number_id", line);
  if (error) throw new Error(`Erro ao listar dados da linha: ${error.message}`);
  const ids = (data || []).map((row: any) => row.id).filter(Boolean);

  for (let i = 0; i < ids.length; i += 200) {
    const { error: deleteMessagesError } = await db
      .from(MESSAGES_TABLE)
      .delete()
      .in("conversa_id", ids.slice(i, i + 200));
    if (deleteMessagesError)
      throw new Error(
        `Erro ao apagar mensagens: ${deleteMessagesError.message}`,
      );
  }

  const { error: deleteConversationsError } = await db
    .from(CONVERSATIONS_TABLE)
    .delete()
    .eq("phone_number_id", line);
  if (deleteConversationsError) {
    throw new Error(
      `Erro ao apagar conversas: ${deleteConversationsError.message}`,
    );
  }
  console.log(
    `[WhatsApp] cópia da linha ${line} apagada: ${ids.length} conversas.`,
  );
}

async function deleteOtherLines(line: string) {
  const db = admin();
  const { data, error } = await db
    .from(CONVERSATIONS_TABLE)
    .select("id")
    .neq("phone_number_id", line);
  if (error) throw new Error(`Erro ao listar linhas antigas: ${error.message}`);
  const ids = (data || []).map((row: any) => row.id).filter(Boolean);

  for (let i = 0; i < ids.length; i += 200) {
    const { error: deleteMessagesError } = await db
      .from(MESSAGES_TABLE)
      .delete()
      .in("conversa_id", ids.slice(i, i + 200));
    if (deleteMessagesError)
      throw new Error(
        `Erro ao apagar mensagens antigas: ${deleteMessagesError.message}`,
      );
  }
  const { error: deleteConversationsError } = await db
    .from(CONVERSATIONS_TABLE)
    .delete()
    .neq("phone_number_id", line);
  if (deleteConversationsError)
    throw new Error(
      `Erro ao apagar conversas antigas: ${deleteConversationsError.message}`,
    );
}

async function conversation(
  phone: string,
  line: string,
  message: string,
  contactName?: string | null,
  date?: string,
  avatarUrl?: string | null,
) {
  const db = admin();
  const now = date || new Date().toISOString();
  const { data: found, error: findError } = await db
    .from(CONVERSATIONS_TABLE)
    .select("id, nome_cliente, avatar_url, nao_lidas")
    .eq("phone_number_id", line)
    .eq("telefone", phone)
    .limit(1)
    .maybeSingle();
  if (findError)
    throw new Error(`Erro ao procurar conversa: ${findError.message}`);

  if (found?.id) {
    const update: Record<string, unknown> = {};
    if (message) {
      update.ultima_mensagem_preview = message;
      update.ultima_mensagem_em = now;
    }
    if (contactName && !found.nome_cliente) update.nome_cliente = contactName;
    if (avatarUrl && !found.avatar_url) update.avatar_url = avatarUrl;
    if (Object.keys(update).length) {
      const { error } = await db
        .from(CONVERSATIONS_TABLE)
        .update(update)
        .eq("id", found.id);
      if (error)
        throw new Error(`Erro ao actualizar conversa: ${error.message}`);
    }
    return found.id as string;
  }

  const { data, error } = await db
    .from(CONVERSATIONS_TABLE)
    .insert({
      empresa: company(),
      phone_number_id: line,
      telefone: phone,
      nome_cliente: contactName || runtime().contacts.get(phone) || null,
      avatar_url: avatarUrl || null,
      status: "aguardando_aceite",
      ia_ativa: false,
      ultima_mensagem_preview: message || "Conversa importada",
      ultima_mensagem_em: message ? now : null,
    })
    .select("id")
    .single();
  if (error || !data?.id)
    throw new Error(
      `Erro ao criar conversa: ${error?.message || "id ausente"}`,
    );
  return data.id as string;
}

async function saveMessage(
  message: any,
  line: string,
  updateConversation = true,
) {
  const phone = digits(message?.key?.remoteJid);
  const selfChat = phone === line && Boolean(message?.key?.fromMe);
  if (!phone || (phone === line && !selfChat)) return;
  const text = preview(message?.message);
  const date = iso(message?.messageTimestamp);
  const sender = message?.key?.fromMe ? "vendedor" : "cliente";
  const id = await conversation(
    phone,
    line,
    updateConversation ? text : "",
    message?.pushName || null,
    date,
  );
  const payload: Record<string, unknown> = {
    conversa_id: id,
    phone_number_id: line,
    remetente: sender,
    texto: text,
    lida: sender === "vendedor",
    created_at: date,
  };
  const externalId = messageId(message?.key);
  if (externalId) payload.whatsapp_message_id = externalId;
  const { error } = await admin().from(MESSAGES_TABLE).upsert(payload, {
    onConflict: "whatsapp_message_id",
    ignoreDuplicates: true,
  });
  if (error) throw new Error(`Erro ao guardar mensagem: ${error.message}`);
}

async function saveContact(contact: any, line: string) {
  const phone = digits(contact?.id);
  const name = nameOf(contact);
  if (!phone || phone === line) return;
  const avatar = await avatarFor(phone, line);
  if (name) runtime().contacts.set(phone, name);
  const { error: contactError } = await admin()
    .from(CONTACTS_TABLE)
    .upsert(
      {
        phone_number_id: line,
        telefone: phone,
        nome: name || null,
        avatar_url: avatar,
        tipo: String(contact?.id || "").includes("@g.us")
          ? "grupo"
          : "contacto",
        actualizado_em: new Date().toISOString(),
      },
      { onConflict: "phone_number_id,telefone" },
    );
  if (contactError)
    throw new Error(`Erro ao guardar contacto: ${contactError.message}`);
  const { error } = await admin()
    .from(CONVERSATIONS_TABLE)
    .update({
      ...(name ? { nome_cliente: name } : {}),
      ...(avatar ? { avatar_url: avatar } : {}),
    })
    .eq("phone_number_id", line)
    .eq("telefone", phone);
  if (error) throw new Error(`Erro ao actualizar conversa: ${error.message}`);
}

async function saveChat(chat: any, line: string) {
  const phone = digits(chat?.id);
  if (!phone || phone === line) return;
  const name = nameOf(chat);
  if (name) runtime().contacts.set(phone, name);
  const avatar = await avatarFor(phone, line);
  await conversation(
    phone,
    line,
    preview(chat?.lastMessage?.message),
    name,
    chat?.conversationTimestamp ? iso(chat.conversationTimestamp) : undefined,
    avatar,
  );
}

async function saveHistory(event: any, line: string) {
  for (const contact of event?.contacts || []) {
    try {
      await saveContact(contact, line);
    } catch (error) {
      console.warn("[WhatsApp] erro ao sincronizar nome:", error);
    }
  }
  for (const chat of event?.chats || []) await saveChat(chat, line);
  for (const message of event?.messages || [])
    await saveMessage(message, line, false);
  console.log(
    `[WhatsApp] histórico sincronizado: ${(event?.chats || []).length} conversas, ${(event?.messages || []).length} mensagens.`,
  );
}

function codeOf(error: any) {
  return error?.output?.statusCode || error?.statusCode || null;
}

function reconnect(delay = 2000) {
  const r = runtime();
  if (r.stopping || r.reconnectTimer) return;
  r.reconnectTimer = setTimeout(() => {
    r.reconnectTimer = null;
    void iniciarBaileys();
  }, delay);
}

export async function iniciarBaileys(): Promise<Operation> {
  const r = runtime();
  if (r.sock)
    return {
      sucesso: true,
      mensagem: r.connected
        ? "WhatsApp já está conectado."
        : "Conexão em andamento.",
    };
  if (r.starting) return r.starting;

  r.starting = (async () => {
    try {
      r.stopping = false;
      // A sessão deve abrir com um único socket estável. O modo full history
      // fica desactivado durante o pairing porque está a provocar 428 no WA Web.
      r.syncHistoryNext = false;
      const baileys = await import("@whiskeysockets/baileys");
      const { state, saveCreds } =
        await baileys.useMultiFileAuthState(authDir());
      let version: [number, number, number] | undefined;
      try {
        version = (await baileys.fetchLatestBaileysVersion()).version;
      } catch {}
      const existing = Boolean((state.creds as any)?.me?.id);
      const fullSync = false;
      const socket = baileys.default({
        auth: state,
        ...(version ? { version } : {}),
        browser: baileys.Browsers.windows("Desktop"),
        printQRInTerminal: false,
        syncFullHistory: fullSync,
        markOnlineOnConnect: false,
        connectTimeoutMs: 60_000,
        defaultQueryTimeoutMs: 60_000,
        keepAliveIntervalMs: 20_000,
        retryRequestDelayMs: 5_000,
        getMessage: async (key: any) => {
          const id = messageId(key);
          if (!id) return undefined;
          const { data } = await admin()
            .from(MESSAGES_TABLE)
            .select("texto")
            .eq("whatsapp_message_id", id)
            .maybeSingle();
          return data?.texto ? { conversation: data.texto } : undefined;
        },
      });
      r.sock = socket;
      r.connected = false;
      r.lastError = null;

      socket.ev.on("creds.update", () => {
        if (r.sock !== socket || r.stopping) return;
        r.credentialsSave = r.credentialsSave
          .then(() => saveCreds())
          .catch((error) =>
            console.error("[WhatsApp] erro nas credenciais:", error),
          );
      });

      socket.ev.on("connection.update", async (update: any) => {
        const closeCode = codeOf(update?.lastDisconnect?.error);
        console.log("[WhatsApp] connection.update", {
          connection: update?.connection || "event",
          qrRecebido: Boolean(update?.qr),
          novoLogin: Boolean(update?.isNewLogin),
          codigoDesconexao: closeCode,
        });
        if (update?.qr) {
          try {
            const { toDataURL } = await import("qrcode");
            r.qrCode = await toDataURL(update.qr, {
              width: 360,
              margin: 2,
              errorCorrectionLevel: "M",
            });
            await status(false, null, r.qrCode, null);
          } catch (error) {
            r.lastError =
              error instanceof Error ? error.message : "Erro no QR Code";
          }
        }
        if (update?.connection === "open") {
          const line = activeLine(socket);
          r.connected = true;
          r.qrCode = null;
          await deleteOtherLines(
            line || process.env.WHATSAPP_PHONE_NUMBER_ID || "baileys",
          );
          await status(true, line, null, null);
          console.log("[WhatsApp] conectado como", line);
          return;
        }
        if (update?.connection !== "close") return;
        const line = activeLine(socket);
        r.connected = false;
        if (r.sock === socket) r.sock = null;
        if (r.stopping) {
          await status(false, null, null, null);
          return;
        }
        if (closeCode === baileys.DisconnectReason.loggedOut) {
          await rm(authDir(), { recursive: true, force: true });
          await deleteConversationData(line);
          await status(false, null, null, "Sessão terminada; leia um novo QR.");
          return;
        }
        await status(
          false,
          null,
          null,
          `Conexão encerrada (${closeCode || "sem código"}); a preservar sessão para sincronizar o histórico.`,
        );
        reconnect(closeCode === 428 ? 2500 : 2000);
      });

      socket.ev.on("messaging-history.set", (event: any) => {
        const line = activeLine(socket);
        if (line)
          void saveHistory(event, line).catch((error) =>
            console.error("[WhatsApp] erro no histórico:", error),
          );
      });
      socket.ev.on("chats.upsert", (chats: any[]) => {
        const line = activeLine(socket);
        if (line)
          void Promise.all(
            (chats || []).map((chat) => saveChat(chat, line)),
          ).catch(console.error);
      });
      socket.ev.on("chats.update", (chats: any[]) => {
        const line = activeLine(socket);
        if (line)
          void Promise.all(
            (chats || []).map((chat) => saveChat(chat, line)),
          ).catch(console.error);
      });
      socket.ev.on("contacts.upsert", (contacts: any[]) => {
        const line = activeLine(socket);
        if (line)
          void Promise.all(
            (contacts || []).map((contact) => saveContact(contact, line)),
          ).catch(console.error);
      });
      socket.ev.on("messages.update", (updates: any[]) => {
        const line = activeLine(socket);
        if (!line) return;
        void Promise.all(
          (updates || []).map(async ({ key, update }: any) => {
            const externalId = messageId(key);
            if (!externalId) return;
            const statusCode = Number(update?.status || 0);
            if (statusCode >= 3) {
              await admin()
                .from(MESSAGES_TABLE)
                .update({ lida: true })
                .eq("whatsapp_message_id", externalId)
                .eq("phone_number_id", line);
            }
          }),
        ).catch((error) =>
          console.warn("[WhatsApp] erro ao actualizar recibo:", error),
        );
      });
      socket.ev.on("presence.update", (event: any) => {
        const line = activeLine(socket);
        const phone = digits(event?.id);
        const presence = Object.values(event?.presences || {})[0] as any;
        if (!line || !phone || !presence?.lastKnownPresence) return;
        void (async () => {
          try {
            const { error } = await admin()
              .from(CONVERSATIONS_TABLE)
              .update({
                presenca: presence.lastKnownPresence,
                ultima_presenca_em: new Date().toISOString(),
              })
              .eq("phone_number_id", line)
              .eq("telefone", phone);
            if (error)
              console.warn("[WhatsApp] erro ao guardar presença:", error);
          } catch (error) {
            console.warn("[WhatsApp] erro ao guardar presença:", error);
          }
        })();
      });
      socket.ev.on("messages.upsert", (event: any) => {
        const items = Array.isArray(event?.messages) ? event.messages : [];
        console.log("[WhatsApp] messages.upsert", {
          tipo: event?.type || null,
          quantidade: items.length,
          ids: items.slice(0, 5).map((message: any) => messageId(message?.key)),
        });
        if (!["notify", "append"].includes(event?.type)) return;
        const line = activeLine(socket);
        if (!line) {
          console.warn("[WhatsApp] mensagem recebida sem linha activa.");
          return;
        }
        void Promise.all(
          items.map(async (message: any) => {
            try {
              await saveMessage(message, line, true);
            } catch (error) {
              console.error(
                "[WhatsApp] erro ao persistir mensagem recebida:",
                error,
              );
            }
          }),
        );
      });
      return {
        sucesso: true,
        mensagem: "Conexão iniciada; aguarde o QR Code.",
      };
    } catch (error) {
      r.sock = null;
      r.connected = false;
      r.lastError =
        error instanceof Error ? error.message : "Erro desconhecido";
      console.error("[WhatsApp] erro ao iniciar:", error);
      return { sucesso: false, erro: r.lastError };
    } finally {
      r.starting = null;
    }
  })();
  return r.starting;
}

export async function desconectarBaileys() {
  const r = runtime();
  r.stopping = true;
  if (r.reconnectTimer) clearTimeout(r.reconnectTimer);
  const socket = r.sock;
  const line = activeLine(socket);
  r.sock = null;
  r.connected = false;
  r.qrCode = null;
  try {
    await socket?.logout();
  } catch {
    try {
      socket?.end?.();
    } catch {}
  }
  await r.credentialsSave;
  await rm(authDir(), { recursive: true, force: true });
  await deleteConversationData(line);
  await status(false, null, null, null);
}

export async function resetarBaileys(): Promise<Operation> {
  await desconectarBaileys();
  runtime().stopping = false;
  runtime().syncHistoryNext = false;
  return iniciarBaileys();
}

export async function enviarMensagemBaileys(
  numero: string,
  texto: string,
): Promise<Operation> {
  const socket = runtime().sock;
  const line = activeLine(socket);
  if (!socket || !runtime().connected || !line)
    return { sucesso: false, erro: "WhatsApp não está conectado." };
  const number = numero.replace(/\D/g, "");
  if (!/^\d{10,15}$/.test(number))
    return { sucesso: false, erro: "Número inválido; use o código do país." };
  if (!texto.trim()) return { sucesso: false, erro: "Texto vazio." };
  try {
    const sent = await socket.sendMessage(`${number}@s.whatsapp.net`, {
      text: texto.trim(),
    });
    await saveMessage(
      {
        key: {
          remoteJid: `${number}@s.whatsapp.net`,
          id: sent?.key?.id,
          fromMe: true,
        },
        message: { conversation: texto.trim() },
        messageTimestamp: Math.floor(Date.now() / 1000),
      },
      line,
      true,
    );
    return { sucesso: true, mensagem: "Mensagem enviada." };
  } catch (error) {
    return {
      sucesso: false,
      erro: error instanceof Error ? error.message : "Erro ao enviar mensagem.",
    };
  }
}

export async function reagirMensagemBaileys(
  conversaId: string,
  whatsappMessageId: string,
  reaction: string,
) {
  const socket = runtime().sock;
  const line = activeLine(socket);
  if (!socket || !runtime().connected || !line)
    return { sucesso: false, erro: "WhatsApp não está conectado." };
  if (!whatsappMessageId || reaction.length > 8)
    return { sucesso: false, erro: "Mensagem ou reacção inválida." };
  const { data: conversa, error } = await admin()
    .from(CONVERSATIONS_TABLE)
    .select("telefone, phone_number_id")
    .eq("id", conversaId)
    .eq("phone_number_id", line)
    .maybeSingle();
  if (error || !conversa?.telefone)
    return { sucesso: false, erro: "Conversa não encontrada na linha actual." };
  try {
    await socket.sendMessage(`${conversa.telefone}@s.whatsapp.net`, {
      react: {
        text: reaction,
        key: {
          remoteJid: `${conversa.telefone}@s.whatsapp.net`,
          id: whatsappMessageId,
          fromMe: false,
        },
      },
    });
    await admin()
      .from(MESSAGES_TABLE)
      .update({ reacao: reaction || null })
      .eq("whatsapp_message_id", whatsappMessageId)
      .eq("phone_number_id", line);
    return { sucesso: true, mensagem: "Reacção enviada." };
  } catch (error) {
    return {
      sucesso: false,
      erro: error instanceof Error ? error.message : "Erro ao reagir.",
    };
  }
}

export function obterQRCode() {
  return runtime().qrCode;
}
export function obterStatusBaileys() {
  const r = runtime();
  return {
    conectado: r.connected,
    iniciando: Boolean(r.starting),
    qrDisponivel: Boolean(r.qrCode),
    erro: r.lastError,
  };
}
