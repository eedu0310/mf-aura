/**
 * Gerenciador de conexões WhatsApp (Baileys) — um socket por vendedor.
 *
 * O estado fica em `globalThis` de propósito: no Next.js cada rota pode ser
 * empacotada separadamente e o hot-reload recria módulos, então um singleton
 * de módulo comum "perde" a sessão entre rotas. Com globalThis todas as rotas
 * enxergam o mesmo socket.
 */
import path from "path";
import fs from "fs";
import QRCode from "qrcode";
import pino from "pino";

export type WaStatus = "disconnected" | "connecting" | "qr" | "connected";
export type WaMsgType = "text" | "image" | "video" | "audio" | "document" | "sticker" | "location" | "contact";

export interface WaMessage {
  id: string;
  chatId: string;
  fromMe: boolean;
  text: string;
  timestamp: number;
  type: WaMsgType;
  hasMedia: boolean;
  mimetype?: string;
  fileName?: string;
  /** 0 erro · 1 pendente · 2 enviado (✓) · 3 entregue (✓✓) · 4 lido (✓✓ azul) */
  status?: number;
}

export interface WaChat {
  id: string;
  name: string;
  phone: string;
  lastMessage: string;
  lastFromMe: boolean;
  lastType: WaMsgType;
  timestamp: number;
  unread: number;
}

interface WaSession {
  userId: string;
  status: WaStatus;
  qrDataUrl: string | null;
  phone: string | null;
  name: string | null;
  jid: string | null;
  error: string | null;
  sock: any;
  manualStop: boolean;
  reconnects: number;
  chats: Map<string, WaChat>;
  messages: Map<string, WaMessage[]>;
  raw: Map<string, any>;
  avatars: Map<string, { url: string | null; at: number }>;
}

type MessageListener = (userId: string, chatId: string, msg: WaMessage) => void;

const SESSIONS_DIR = path.join(process.cwd(), ".whatsapp-sessions");
const MAX_MSGS_PER_CHAT = 400;
const MAX_RAW = 3000;
const AVATAR_TTL = 6 * 60 * 60 * 1000;

const g = globalThis as unknown as {
  __auraWaSessions?: Map<string, WaSession>;
  __auraWaListeners?: Set<MessageListener>;
  __auraWaBaileys?: any;
};
const sessions: Map<string, WaSession> = (g.__auraWaSessions ??= new Map());
const listeners: Set<MessageListener> = (g.__auraWaListeners ??= new Set());

/** Permite que o Supervisor de IA seja avisado a cada mensagem nova. */
export function onMessage(listener: MessageListener) {
  listeners.add(listener);
}

function authDir(userId: string) {
  return path.join(SESSIONS_DIR, userId.replace(/[^a-zA-Z0-9_-]/g, "_"));
}

function getOrCreate(userId: string): WaSession {
  let s = sessions.get(userId);
  if (!s) {
    s = {
      userId,
      status: "disconnected",
      qrDataUrl: null,
      phone: null,
      name: null,
      jid: null,
      error: null,
      sock: null,
      manualStop: false,
      reconnects: 0,
      chats: new Map(),
      messages: new Map(),
      raw: new Map(),
      avatars: new Map(),
    };
    sessions.set(userId, s);
  }
  s.raw ??= new Map();
  s.avatars ??= new Map();
  return s;
}

async function loadBaileys() {
  if (g.__auraWaBaileys) return g.__auraWaBaileys;
  const mod: any = await import("@whiskeysockets/baileys");
  g.__auraWaBaileys = {
    makeWASocket: mod.makeWASocket ?? mod.default,
    useMultiFileAuthState: mod.useMultiFileAuthState,
    DisconnectReason: mod.DisconnectReason,
    fetchLatestBaileysVersion: mod.fetchLatestBaileysVersion,
    downloadMediaMessage: mod.downloadMediaMessage,
    Browsers: mod.Browsers,
  };
  return g.__auraWaBaileys;
}

function unwrap(message: any): any {
  if (!message) return null;
  return (
    message.ephemeralMessage?.message ??
    message.viewOnceMessage?.message ??
    message.viewOnceMessageV2?.message ??
    message.documentWithCaptionMessage?.message ??
    message.editedMessage?.message ??
    message
  );
}

interface Parsed {
  text: string;
  type: WaMsgType;
  hasMedia: boolean;
  mimetype?: string;
  fileName?: string;
}

function parseMessage(raw: any): Parsed | null {
  const m = unwrap(raw);
  if (!m) return null;
  if (m.conversation) return { text: m.conversation, type: "text", hasMedia: false };
  if (m.extendedTextMessage?.text) return { text: m.extendedTextMessage.text, type: "text", hasMedia: false };
  if (m.imageMessage)
    return { text: m.imageMessage.caption ?? "", type: "image", hasMedia: true, mimetype: m.imageMessage.mimetype };
  if (m.videoMessage)
    return { text: m.videoMessage.caption ?? "", type: "video", hasMedia: true, mimetype: m.videoMessage.mimetype };
  if (m.audioMessage)
    return { text: "", type: "audio", hasMedia: true, mimetype: m.audioMessage.mimetype };
  if (m.documentMessage)
    return {
      text: m.documentMessage.caption ?? "",
      type: "document",
      hasMedia: true,
      mimetype: m.documentMessage.mimetype,
      fileName: m.documentMessage.fileName ?? m.documentMessage.title ?? "Documento",
    };
  if (m.stickerMessage) return { text: "", type: "sticker", hasMedia: true, mimetype: m.stickerMessage.mimetype };
  if (m.locationMessage)
    return {
      text: `📍 Localização${m.locationMessage.name ? `: ${m.locationMessage.name}` : ""}`,
      type: "location",
      hasMedia: false,
    };
  if (m.contactMessage)
    return { text: `👤 ${m.contactMessage.displayName ?? "Contato"}`, type: "contact", hasMedia: false };
  if (m.buttonsResponseMessage?.selectedDisplayText)
    return { text: m.buttonsResponseMessage.selectedDisplayText, type: "text", hasMedia: false };
  if (m.listResponseMessage?.title) return { text: m.listResponseMessage.title, type: "text", hasMedia: false };
  return null;
}

export function previewOf(msg: Pick<WaMessage, "type" | "text" | "fileName">) {
  switch (msg.type) {
    case "image":
      return `📷 ${msg.text || "Foto"}`;
    case "video":
      return `🎥 ${msg.text || "Vídeo"}`;
    case "audio":
      return "🎤 Áudio";
    case "document":
      return `📄 ${msg.fileName ?? "Documento"}`;
    case "sticker":
      return "Figurinha";
    default:
      return msg.text;
  }
}

function isIgnoredJid(jid: string) {
  return (
    !jid ||
    jid.endsWith("@g.us") ||
    jid === "status@broadcast" ||
    jid.endsWith("@newsletter") ||
    jid.endsWith("@broadcast")
  );
}

function phoneFromJid(jid: string) {
  return jid.split("@")[0].split(":")[0];
}

function toMillis(ts: any): number {
  if (!ts) return Date.now();
  const n = typeof ts === "number" ? ts : Number(ts?.toString?.() ?? ts);
  return Number.isFinite(n) && n > 0 ? n * 1000 : Date.now();
}

function addMessage(s: WaSession, msg: any, live: boolean) {
  const jid: string | undefined = msg?.key?.remoteJid;
  if (!jid || isIgnoredJid(jid)) return;
  const parsed = parseMessage(msg.message);
  if (!parsed) return;

  const id: string = msg.key.id ?? `${Date.now()}-${Math.random()}`;
  const list = s.messages.get(jid) ?? [];
  if (list.some((m) => m.id === id)) return;

  const fromMe = !!msg.key.fromMe;
  const timestamp = toMillis(msg.messageTimestamp);
  const item: WaMessage = {
    id,
    chatId: jid,
    fromMe,
    timestamp,
    status: fromMe ? (typeof msg.status === "number" ? msg.status : 2) : undefined,
    ...parsed,
  };
  list.push(item);
  list.sort((a, b) => a.timestamp - b.timestamp);
  if (list.length > MAX_MSGS_PER_CHAT) list.splice(0, list.length - MAX_MSGS_PER_CHAT);
  s.messages.set(jid, list);

  if (parsed.hasMedia) {
    s.raw.set(id, msg);
    if (s.raw.size > MAX_RAW) {
      const first = s.raw.keys().next().value;
      if (first) s.raw.delete(first);
    }
  }

  const altJid: string | undefined = msg.key.remoteJidAlt ?? msg.key.senderPn;
  const phone = phoneFromJid(altJid && altJid.includes("@s.whatsapp.net") ? altJid : jid);
  const chat: WaChat = s.chats.get(jid) ?? {
    id: jid,
    name: phone,
    phone,
    lastMessage: "",
    lastFromMe: false,
    lastType: "text",
    timestamp: 0,
    unread: 0,
  };
  if (!fromMe && msg.pushName) chat.name = msg.pushName;
  if (timestamp >= chat.timestamp) {
    chat.lastMessage = previewOf(item);
    chat.lastFromMe = fromMe;
    chat.lastType = item.type;
    chat.timestamp = timestamp;
  }
  if (live && !fromMe) chat.unread += 1;
  s.chats.set(jid, chat);

  if (live) {
    for (const l of listeners) {
      try {
        l(s.userId, jid, item);
      } catch (e) {
        console.error("[whatsapp] listener:", e);
      }
    }
  }
}

function wipeAuth(userId: string) {
  try {
    fs.rmSync(authDir(userId), { recursive: true, force: true });
  } catch {
    /* ignora */
  }
}

export function hasSavedLogin(userId: string) {
  return fs.existsSync(path.join(authDir(userId), "creds.json"));
}

export async function startSession(userId: string): Promise<WaSession> {
  const s = getOrCreate(userId);
  if (s.sock && s.status !== "disconnected") return s;

  s.status = "connecting";
  s.error = null;
  s.manualStop = false;

  try {
    const B = await loadBaileys();
    const dir = authDir(userId);
    fs.mkdirSync(dir, { recursive: true });
    const { state, saveCreds } = await B.useMultiFileAuthState(dir);

    let version: number[] | undefined;
    try {
      version = (await B.fetchLatestBaileysVersion()).version;
    } catch {
      version = undefined;
    }

    const sock = B.makeWASocket({
      auth: state,
      version,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      browser: B.Browsers?.ubuntu ? B.Browsers.ubuntu("AURA CRM") : ["AURA CRM", "Chrome", "120.0.0"],
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });
    s.sock = sock;

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (u: any) => {
      if (s.sock !== sock) return;

      if (u.qr) {
        try {
          s.qrDataUrl = await QRCode.toDataURL(u.qr, { width: 320, margin: 1 });
          s.status = "qr";
        } catch (e) {
          s.error = "Falha ao gerar o QR code";
          console.error("[whatsapp] QR:", e);
        }
      }

      if (u.connection === "open") {
        s.status = "connected";
        s.qrDataUrl = null;
        s.error = null;
        s.reconnects = 0;
        s.jid = sock.user?.id ?? null;
        s.phone = sock.user?.id ? phoneFromJid(sock.user.id) : null;
        s.name = sock.user?.name ?? sock.user?.verifiedName ?? null;
        console.log(`[whatsapp] conectado: ${s.phone} (usuário ${userId})`);
      }

      if (u.connection === "close") {
        const code = u.lastDisconnect?.error?.output?.statusCode;
        const wasQr = s.status === "qr";
        s.sock = null;
        console.log(`[whatsapp] conexão fechada (código ${code})`);

        if (s.manualStop) {
          s.status = "disconnected";
          return;
        }
        if (code === B.DisconnectReason.loggedOut) {
          wipeAuth(userId);
          s.status = "disconnected";
          s.qrDataUrl = null;
          s.phone = null;
          s.chats.clear();
          s.messages.clear();
          s.raw.clear();
          s.error = "O WhatsApp foi desconectado pelo celular. Conecte novamente.";
          return;
        }
        if (wasQr && code === B.DisconnectReason.timedOut) {
          s.status = "disconnected";
          s.qrDataUrl = null;
          s.error = "O QR code expirou. Clique em Conectar para gerar outro.";
          return;
        }
        if (s.reconnects < 5) {
          s.reconnects += 1;
          s.status = "connecting";
          setTimeout(() => {
            startSession(userId).catch((e) => console.error("[whatsapp] reconexão:", e));
          }, 1500);
        } else {
          s.status = "disconnected";
          s.error = `Não foi possível manter a conexão (código ${code ?? "?"}). Tente conectar novamente.`;
        }
      }
    });

    sock.ev.on("messaging-history.set", ({ messages, contacts }: any) => {
      for (const m of messages ?? []) addMessage(s, m, false);
      for (const c of contacts ?? []) {
        const chat = s.chats.get(c.id);
        if (chat && (c.name || c.notify)) chat.name = c.name ?? c.notify;
      }
    });

    sock.ev.on("messages.upsert", ({ messages, type }: any) => {
      for (const m of messages ?? []) addMessage(s, m, type === "notify");
    });

    // Tiques de enviado / entregue / lido.
    sock.ev.on("messages.update", (updates: any[]) => {
      for (const { key, update } of updates ?? []) {
        if (typeof update?.status !== "number" || !key?.remoteJid) continue;
        const msg = s.messages.get(key.remoteJid)?.find((m) => m.id === key.id);
        if (msg && msg.fromMe && update.status > (msg.status ?? 0)) msg.status = update.status;
      }
    });

    sock.ev.on("contacts.upsert", (contacts: any[]) => {
      for (const c of contacts ?? []) {
        const chat = s.chats.get(c.id);
        if (chat && (c.name || c.notify)) chat.name = c.name ?? c.notify;
      }
    });
  } catch (e: any) {
    console.error("[whatsapp] erro ao iniciar:", e);
    s.sock = null;
    s.status = "disconnected";
    s.error = `Erro ao iniciar o WhatsApp: ${e?.message ?? e}`;
  }

  return s;
}

export async function getState(userId: string) {
  let s = sessions.get(userId);
  // Após reiniciar o servidor, reconecta sozinho se já houver login salvo.
  if ((!s || (!s.sock && s.status === "disconnected" && !s.error && !s.manualStop)) && hasSavedLogin(userId)) {
    s = await startSession(userId);
  }
  s = s ?? getOrCreate(userId);
  const chats = Array.from(s.chats.values()).sort((a, b) => b.timestamp - a.timestamp);
  return {
    status: s.status,
    qrCode: s.qrDataUrl,
    phone: s.phone,
    name: s.name,
    myJid: s.jid,
    error: s.error,
    chats,
  };
}

export function isConnected(userId: string) {
  return sessions.get(userId)?.status === "connected";
}

export function getChat(userId: string, chatId: string): WaChat | null {
  return sessions.get(userId)?.chats.get(chatId) ?? null;
}

export function getChats(userId: string): WaChat[] {
  return Array.from(sessions.get(userId)?.chats.values() ?? []);
}

export function getMessages(userId: string, chatId: string): WaMessage[] {
  return sessions.get(userId)?.messages.get(chatId) ?? [];
}

export function connectedUserIds(): string[] {
  return Array.from(sessions.values())
    .filter((s) => s.status === "connected")
    .map((s) => s.userId);
}

export function markRead(userId: string, chatId: string) {
  const s = sessions.get(userId);
  const chat = s?.chats.get(chatId);
  if (chat) chat.unread = 0;
  try {
    const last = s?.messages.get(chatId)?.filter((m) => !m.fromMe).slice(-1)[0];
    if (s?.sock && last) {
      s.sock.readMessages([{ remoteJid: chatId, id: last.id, fromMe: false }]).catch(() => {});
    }
  } catch {
    /* ignora */
  }
}

/** Foto de perfil (URL do CDN do WhatsApp) com cache de 6h. `null` = sem foto/privada. */
export async function getAvatar(userId: string, jid: string): Promise<string | null> {
  const s = sessions.get(userId);
  if (!s?.sock) return null;
  const cached = s.avatars.get(jid);
  if (cached && Date.now() - cached.at < AVATAR_TTL) return cached.url;
  let url: string | null = null;
  try {
    url = (await s.sock.profilePictureUrl(jid, "preview", 8000)) ?? null;
  } catch {
    url = null;
  }
  s.avatars.set(jid, { url, at: Date.now() });
  return url;
}

/** Baixa a mídia (foto, vídeo, áudio, documento) de uma mensagem. */
export async function getMedia(userId: string, msgId: string) {
  const s = sessions.get(userId);
  const raw = s?.raw.get(msgId);
  if (!s || !raw) return null;
  const B = await loadBaileys();
  const buffer: Buffer = await B.downloadMediaMessage(
    raw,
    "buffer",
    {},
    { logger: pino({ level: "silent" }), reuploadRequest: s.sock?.updateMediaMessage },
  );
  const parsed = parseMessage(raw.message);
  return {
    buffer,
    mimetype: parsed?.mimetype ?? "application/octet-stream",
    fileName: parsed?.fileName,
  };
}

/** Resolve um número digitado (ex.: 54 99999-1234) para o JID do WhatsApp. */
async function resolveJid(s: WaSession, to: string): Promise<string> {
  if (to.includes("@")) return to;
  let digits = to.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (digits.length < 12) throw new Error("Número inválido. Use DDD + número, ex.: 54 99999-1234");
  const result = await s.sock.onWhatsApp(digits);
  const found = Array.isArray(result) ? result[0] : null;
  if (!found?.exists) throw new Error("Esse número não tem WhatsApp.");
  return found.jid;
}

function requireConnected(userId: string) {
  const s = sessions.get(userId);
  if (!s?.sock || s.status !== "connected") throw new Error("WhatsApp não está conectado.");
  return s;
}

async function afterSend(s: WaSession, jid: string, sent: any) {
  if (sent) addMessage(s, sent, false);
  const chat = s.chats.get(jid);
  if (chat) chat.unread = 0;
  const item = s.messages.get(jid)?.slice(-1)[0];
  if (item) {
    for (const l of listeners) {
      try {
        l(s.userId, jid, item);
      } catch {
        /* ignora */
      }
    }
  }
}

export async function sendText(userId: string, to: string, text: string) {
  const s = requireConnected(userId);
  const jid = await resolveJid(s, to);
  const sent = await s.sock.sendMessage(jid, { text });
  await afterSend(s, jid, sent);
  return { chatId: jid };
}

export async function sendFile(
  userId: string,
  to: string,
  file: { buffer: Buffer; mimetype: string; fileName: string },
  caption?: string,
) {
  const s = requireConnected(userId);
  const jid = await resolveJid(s, to);
  const { buffer, mimetype, fileName } = file;
  let content: Record<string, unknown>;
  if (mimetype.startsWith("image/") && !mimetype.includes("svg")) {
    content = { image: buffer, mimetype, caption };
  } else if (mimetype.startsWith("video/")) {
    content = { video: buffer, mimetype, caption };
  } else if (mimetype.startsWith("audio/")) {
    content = { audio: buffer, mimetype };
  } else {
    content = { document: buffer, mimetype, fileName, caption };
  }
  const sent = await s.sock.sendMessage(jid, content);
  await afterSend(s, jid, sent);
  return { chatId: jid };
}

export async function logout(userId: string) {
  const s = sessions.get(userId);
  if (s) {
    s.manualStop = true;
    const sock = s.sock;
    s.sock = null;
    try {
      await sock?.logout();
    } catch {
      try {
        sock?.end?.(undefined);
      } catch {
        /* ignora */
      }
    }
    s.status = "disconnected";
    s.qrDataUrl = null;
    s.phone = null;
    s.name = null;
    s.error = null;
    s.chats.clear();
    s.messages.clear();
    s.raw.clear();
  }
  wipeAuth(userId);
}
