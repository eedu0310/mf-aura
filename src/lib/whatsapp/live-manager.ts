/**
 * Gerenciador de conexões WhatsApp (Baileys) — um socket por vendedor.
 *
 * O estado fica em `globalThis` de propósito: no Next.js cada rota pode ser
 * empacotada separadamente e o hot-reload recria módulos, então um singleton
 * de módulo comum "perde" a sessão entre /connect e /status. Com globalThis
 * todas as rotas enxergam o mesmo socket.
 */
import path from "path";
import fs from "fs";
import QRCode from "qrcode";
import pino from "pino";

export type WaStatus = "disconnected" | "connecting" | "qr" | "connected";

export interface WaMessage {
  id: string;
  chatId: string;
  fromMe: boolean;
  text: string;
  timestamp: number;
}

export interface WaChat {
  id: string;
  name: string;
  phone: string;
  lastMessage: string;
  timestamp: number;
  unread: number;
}

interface WaSession {
  userId: string;
  status: WaStatus;
  qrDataUrl: string | null;
  phone: string | null;
  name: string | null;
  error: string | null;
  sock: any;
  manualStop: boolean;
  reconnects: number;
  chats: Map<string, WaChat>;
  messages: Map<string, WaMessage[]>;
}

const SESSIONS_DIR = path.join(process.cwd(), ".whatsapp-sessions");
const MAX_MSGS_PER_CHAT = 300;

const g = globalThis as unknown as { __auraWaSessions?: Map<string, WaSession> };
const sessions: Map<string, WaSession> = (g.__auraWaSessions ??= new Map());

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
      error: null,
      sock: null,
      manualStop: false,
      reconnects: 0,
      chats: new Map(),
      messages: new Map(),
    };
    sessions.set(userId, s);
  }
  return s;
}

async function loadBaileys() {
  const mod: any = await import("@whiskeysockets/baileys");
  return {
    makeWASocket: mod.makeWASocket ?? mod.default,
    useMultiFileAuthState: mod.useMultiFileAuthState,
    DisconnectReason: mod.DisconnectReason,
    fetchLatestBaileysVersion: mod.fetchLatestBaileysVersion,
    Browsers: mod.Browsers,
  };
}

function unwrap(message: any): any {
  if (!message) return null;
  return (
    message.ephemeralMessage?.message ??
    message.viewOnceMessage?.message ??
    message.viewOnceMessageV2?.message ??
    message.documentWithCaptionMessage?.message ??
    message
  );
}

function extractText(raw: any): string | null {
  const m = unwrap(raw);
  if (!m) return null;
  if (m.conversation) return m.conversation;
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
  if (m.imageMessage) return m.imageMessage.caption ? `📷 ${m.imageMessage.caption}` : "📷 Imagem";
  if (m.videoMessage) return m.videoMessage.caption ? `🎥 ${m.videoMessage.caption}` : "🎥 Vídeo";
  if (m.audioMessage) return "🎤 Áudio";
  if (m.documentMessage) return `📄 ${m.documentMessage.fileName ?? "Documento"}`;
  if (m.stickerMessage) return "Figurinha";
  if (m.locationMessage) return "📍 Localização";
  if (m.contactMessage) return `👤 ${m.contactMessage.displayName ?? "Contato"}`;
  if (m.buttonsResponseMessage?.selectedDisplayText) return m.buttonsResponseMessage.selectedDisplayText;
  if (m.listResponseMessage?.title) return m.listResponseMessage.title;
  return null;
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

function addMessage(s: WaSession, msg: any, countUnread: boolean) {
  const jid: string | undefined = msg?.key?.remoteJid;
  if (!jid || isIgnoredJid(jid)) return;
  const text = extractText(msg.message);
  if (!text) return;

  const id: string = msg.key.id ?? `${Date.now()}-${Math.random()}`;
  const list = s.messages.get(jid) ?? [];
  if (list.some((m) => m.id === id)) return;

  const fromMe = !!msg.key.fromMe;
  const timestamp = toMillis(msg.messageTimestamp);
  list.push({ id, chatId: jid, fromMe, text, timestamp });
  list.sort((a, b) => a.timestamp - b.timestamp);
  if (list.length > MAX_MSGS_PER_CHAT) list.splice(0, list.length - MAX_MSGS_PER_CHAT);
  s.messages.set(jid, list);

  const altJid: string | undefined = msg.key.remoteJidAlt ?? msg.key.senderPn;
  const phone = phoneFromJid(altJid && altJid.includes("@s.whatsapp.net") ? altJid : jid);
  const chat = s.chats.get(jid) ?? {
    id: jid,
    name: phone,
    phone,
    lastMessage: "",
    timestamp: 0,
    unread: 0,
  };
  if (!fromMe && msg.pushName) chat.name = msg.pushName;
  if (timestamp >= chat.timestamp) {
    chat.lastMessage = fromMe ? `Você: ${text}` : text;
    chat.timestamp = timestamp;
  }
  if (countUnread && !fromMe) chat.unread += 1;
  s.chats.set(jid, chat);
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
    error: s.error,
    chats,
  };
}

export function getMessages(userId: string, chatId: string): WaMessage[] {
  return sessions.get(userId)?.messages.get(chatId) ?? [];
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

export async function sendText(userId: string, to: string, text: string) {
  const s = sessions.get(userId);
  if (!s?.sock || s.status !== "connected") throw new Error("WhatsApp não está conectado.");
  const jid = await resolveJid(s, to);
  const sent = await s.sock.sendMessage(jid, { text });
  if (sent) addMessage(s, sent, false);
  const chat = s.chats.get(jid);
  if (chat) chat.unread = 0;
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
  }
  wipeAuth(userId);
}
