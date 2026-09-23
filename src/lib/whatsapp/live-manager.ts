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
  /** JID com o número de telefone (quando a conversa vem como @lid). */
  pnJid: string | null;
  name: string;
  /** true quando `name` veio do WhatsApp (pushName/contato) e não do número. */
  hasName: boolean;
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
  /** Quantas vezes o QR expirou sem ninguém escanear (gera outro sozinho). */
  ciclosQr: number;
  /** A conexão chegou a abrir alguma vez desde que o app subiu? */
  jaAbriu: boolean;
  /** Quando começou a tentar conectar (para destravar sozinho). */
  conectandoDesde: number | null;
  /** Vigia: se o QR não vier a tempo, avisa em vez de ficar rodando. */
  vigia: ReturnType<typeof setTimeout> | null;
  /** O WhatsApp recusou a versão buscada na internet? Usa a embutida. */
  usarVersaoEmbutida: boolean;
  chats: Map<string, WaChat>;
  messages: Map<string, WaMessage[]>;
  raw: Map<string, any>;
  avatars: Map<string, { url: string | null; at: number }>;
  /** Nomes da agenda/pushName por JID (para conversas que chegam sem nome). */
  names: Map<string, string>;
  storeLoaded: boolean;
  saveTimer: ReturnType<typeof setTimeout> | null;
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

/**
 * Registra o passo a passo da conexão num arquivo, além do terminal.
 * Serve para descobrir onde a conexão parou sem precisar ficar olhando o
 * terminal do servidor: .whatsapp-sessions/diagnostico.log
 */
function anotar(mensagem: string) {
  const linha = `${new Date().toISOString()} ${mensagem}`;
  console.log(`[whatsapp] ${mensagem}`);
  try {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    fs.appendFileSync(path.join(SESSIONS_DIR, "diagnostico.log"), linha + "\n");
  } catch {
    /* o log é só apoio; nunca derruba a conexão */
  }
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
      ciclosQr: 0,
      jaAbriu: false,
      conectandoDesde: null,
      vigia: null,
      usarVersaoEmbutida: false,
      chats: new Map(),
      messages: new Map(),
      raw: new Map(),
      avatars: new Map(),
      names: new Map(),
      storeLoaded: false,
      saveTimer: null,
    };
    sessions.set(userId, s);
  }
  s.raw ??= new Map();
  s.avatars ??= new Map();
  s.names ??= new Map();
  s.ciclosQr ??= 0;
  s.jaAbriu ??= false;
  s.vigia ??= null;
  s.usarVersaoEmbutida ??= false;
  // Sessão que ficou de uma versão anterior do código não tem o carimbo de
  // hora. Sem isso ela ficaria presa em "conectando" para sempre.
  if (s.conectandoDesde === undefined) s.conectandoDesde = s.status === "connecting" ? 0 : null;
  return s;
}

// ------------------------------------------------------------------ persistência
// As conversas ficam salvas em disco: o WhatsApp só manda o histórico uma vez
// (quando o aparelho é conectado), então sem isso tudo sumia ao reiniciar.

function storePath(userId: string) {
  return path.join(SESSIONS_DIR, "_store", `${userId.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
}

async function loadStore(s: WaSession) {
  if (s.storeLoaded) return;
  s.storeLoaded = true;
  try {
    const file = storePath(s.userId);
    if (!fs.existsSync(file)) return;
    const B = await loadBaileys();
    const data = JSON.parse(fs.readFileSync(file, "utf8"), B.BufferJSON?.reviver);
    for (const c of data.chats ?? []) {
      if (!s.chats.has(c.id)) s.chats.set(c.id, { pnJid: null, hasName: false, lastFromMe: false, lastType: "text", ...c });
    }
    for (const [jid, list] of Object.entries(data.messages ?? {}) as [string, WaMessage[]][]) {
      const atual = s.messages.get(jid) ?? [];
      const ids = new Set(atual.map((m) => m.id));
      const juntos = [...list.filter((m) => !ids.has(m.id)), ...atual].sort((a, b) => a.timestamp - b.timestamp);
      s.messages.set(jid, juntos.slice(-MAX_MSGS_PER_CHAT));
    }
    for (const [id, raw] of Object.entries(data.raw ?? {})) if (!s.raw.has(id)) s.raw.set(id, raw);
    for (const [jid, nome] of Object.entries(data.names ?? {}) as [string, string][]) s.names.set(jid, nome);
    console.log(`[whatsapp] ${s.chats.size} conversas carregadas do disco`);
  } catch (e) {
    console.error("[whatsapp] erro ao carregar conversas salvas:", e);
  }
}

function markDirty(s: WaSession) {
  if (s.saveTimer) return;
  s.saveTimer = setTimeout(() => {
    s.saveTimer = null;
    saveStore(s).catch((e) => console.error("[whatsapp] erro ao salvar conversas:", e));
  }, 3000);
}

async function saveStore(s: WaSession) {
  const B = await loadBaileys();
  const file = storePath(s.userId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const data = {
    savedAt: Date.now(),
    chats: Array.from(s.chats.values()),
    messages: Object.fromEntries(s.messages),
    raw: Object.fromEntries(s.raw),
    names: Object.fromEntries(s.names),
  };
  const tmp = `${file}.tmp`;
  await fs.promises.writeFile(tmp, JSON.stringify(data, B.BufferJSON?.replacer));
  await fs.promises.rename(tmp, file);
}

function upsertChatInfo(s: WaSession, c: any) {
  const jid: string | undefined = c?.id;
  if (!jid || isIgnoredJid(jid)) return;
  const pnJid: string | null = jid.endsWith("@s.whatsapp.net")
    ? jid
    : typeof c.pnJid === "string" && c.pnJid.endsWith("@s.whatsapp.net")
    ? c.pnJid
    : null;
  const phone = phoneFromJid(pnJid ?? jid);
  const nomeConhecido = c.name || c.displayName || s.names.get(jid) || (pnJid ? s.names.get(pnJid) : undefined);
  const chat: WaChat = s.chats.get(jid) ?? {
    id: jid,
    pnJid,
    name: nomeConhecido || (pnJid ? formatPhoneBr(phone) : "Contato"),
    hasName: !!nomeConhecido,
    phone,
    lastMessage: "",
    lastFromMe: false,
    lastType: "text",
    timestamp: 0,
    unread: 0,
  };
  if (pnJid && !chat.pnJid) {
    chat.pnJid = pnJid;
    chat.phone = phone;
  }
  if (nomeConhecido && !chat.hasName) {
    chat.name = nomeConhecido;
    chat.hasName = true;
  }
  const ts = c.conversationTimestamp ?? c.lastMessageRecvTimestamp;
  if (ts) chat.timestamp = Math.max(chat.timestamp, toMillis(ts));
  if (typeof c.unreadCount === "number" && c.unreadCount >= 0) chat.unread = c.unreadCount;
  s.chats.set(jid, chat);
}

function registrarNome(s: WaSession, jid: string | undefined, nome: string | undefined | null) {
  if (!jid || !nome) return;
  s.names.set(jid, nome);
  const chat = s.chats.get(jid) ?? Array.from(s.chats.values()).find((c) => c.pnJid === jid);
  if (chat) {
    chat.name = nome;
    chat.hasName = true;
  }
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

export function formatPhoneBr(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) {
    const rest = d.slice(4);
    return `+55 ${d.slice(2, 4)} ${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`;
  }
  return d.length > 13 ? "Contato" : `+${d}`;
}

/** Baileys 7 identifica alguns contatos por LID; aqui buscamos o número real. */
async function resolvePn(s: WaSession, chat: WaChat) {
  if (chat.pnJid || !chat.id.endsWith("@lid") || !s.sock) return;
  try {
    const pn: string | null = await s.sock.signalRepository?.lidMapping?.getPNForLID?.(chat.id);
    if (pn) {
      const pnJid = `${phoneFromJid(pn)}@s.whatsapp.net`;
      chat.pnJid = pnJid;
      chat.phone = phoneFromJid(pnJid);
      if (!chat.hasName) chat.name = formatPhoneBr(chat.phone);
    }
  } catch {
    /* sem mapeamento ainda */
  }
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
  const pnJid = jid.endsWith("@s.whatsapp.net") ? jid : altJid?.endsWith("@s.whatsapp.net") ? altJid : null;
  const phone = phoneFromJid(pnJid ?? jid);
  const existente = s.chats.get(jid);
  const chat: WaChat = existente ?? {
    id: jid,
    pnJid,
    name: s.names.get(jid) ?? (pnJid ? s.names.get(pnJid) : undefined) ?? (pnJid ? formatPhoneBr(phone) : "Contato"),
    hasName: !!(s.names.get(jid) ?? (pnJid ? s.names.get(pnJid) : undefined)),
    phone,
    lastMessage: "",
    lastFromMe: false,
    lastType: "text",
    timestamp: 0,
    unread: 0,
  };
  if (pnJid && !chat.pnJid) {
    chat.pnJid = pnJid;
    chat.phone = phone;
    if (!chat.hasName) chat.name = formatPhoneBr(phone);
  }
  if (!fromMe && msg.pushName) {
    chat.name = msg.pushName;
    chat.hasName = true;
  }
  if (!chat.pnJid) void resolvePn(s, chat);
  if (timestamp >= chat.timestamp) {
    chat.lastMessage = previewOf(item);
    chat.lastFromMe = fromMe;
    chat.lastType = item.type;
    chat.timestamp = timestamp;
  }
  if (live && !fromMe) chat.unread += 1;
  s.chats.set(jid, chat);
  markDirty(s);

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

  // Sessão presa em "conectando" há muito tempo: derruba e recomeça, em vez
  // de devolver o mesmo estado travado a cada clique em Conectar.
  const presa =
    s.status === "connecting" && Date.now() - (s.conectandoDesde ?? 0) > 30_000;
  if (presa) {
    anotar("a tentativa anterior travou; recomeçando do zero");
    try {
      s.sock?.end?.(undefined);
    } catch {
      /* já estava morto */
    }
    s.sock = null;
    s.status = "disconnected";
  }

  if (s.sock && s.status !== "disconnected") return s;

  s.status = "connecting";
  s.error = null;
  s.manualStop = false;
  s.reconnects = 0;
  s.conectandoDesde = Date.now();
  if (s.vigia) clearTimeout(s.vigia);
  // Se em 40 segundos não vier QR nem conexão, o usuário precisa saber.
  s.vigia = setTimeout(() => {
    if (s.status === "connecting" && !s.qrDataUrl) {
      anotar("40s sem QR e sem conexão — provável bloqueio de rede/firewall");
      s.status = "disconnected";
      s.error =
        "Não consegui falar com o WhatsApp em 40 segundos. Verifique a internet do computador (e se algum antivírus ou firewall está bloqueando) e clique em Conectar de novo.";
      try {
        s.sock?.end?.(undefined);
      } catch {
        /* nada a fazer */
      }
      s.sock = null;
    }
  }, 40_000);

  try {
    const B = await loadBaileys();
    await loadStore(s);
    const dir = authDir(userId);
    fs.mkdirSync(dir, { recursive: true });
    const { state, saveCreds } = await B.useMultiFileAuthState(dir);

    // A consulta da versão vai à internet e pode travar; 5s no máximo.
    // Se o WhatsApp já tiver recusado a versão de lá, vai direto na embutida.
    let version: number[] | undefined;
    if (!s.usarVersaoEmbutida) {
      try {
        const resultado = await Promise.race([
          B.fetchLatestBaileysVersion(),
          new Promise<null>((r) => setTimeout(() => r(null), 5000)),
        ]);
        version = (resultado as any)?.version;
        if (!version) console.warn("[whatsapp] versão não veio a tempo; usando a embutida");
      } catch {
        version = undefined;
      }
    }
    anotar(`abrindo conexão (versão ${version ? version.join(".") : "embutida"})`);

    const sock = B.makeWASocket({
      auth: state,
      // Só manda a versão quando ela existe: passar `undefined` faz a
      // biblioteca quebrar em vez de usar a versão que ela já traz.
      ...(version ? { version } : {}),
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      // "Desktop" + syncFullHistory faz o celular mandar o histórico completo
      // de conversas ao conectar (como no WhatsApp Web/Desktop).
      browser: B.Browsers?.macOS ? B.Browsers.macOS("Desktop") : ["AURA CRM", "Desktop", "120.0.0"],
      syncFullHistory: true,
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
          if (s.vigia) { clearTimeout(s.vigia); s.vigia = null; }
          s.conectandoDesde = null;
          anotar("QR code gerado — escaneie pelo celular");
        } catch (e) {
          s.error = "Falha ao gerar o QR code";
          console.error("[whatsapp] QR:", e);
        }
      }

      if (u.connection === "open") {
        s.status = "connected";
        if (s.vigia) { clearTimeout(s.vigia); s.vigia = null; }
        s.conectandoDesde = null;
        s.qrDataUrl = null;
        s.error = null;
        s.reconnects = 0;
        s.ciclosQr = 0;
        s.jaAbriu = true;
        s.jid = sock.user?.id ?? null;
        s.phone = sock.user?.id ? phoneFromJid(sock.user.id) : null;
        s.name = sock.user?.name ?? sock.user?.verifiedName ?? null;
        anotar(`conectado: ${s.phone}`);
      }

      if (u.connection === "close") {
        const code = u.lastDisconnect?.error?.output?.statusCode;
        const wasQr = s.status === "qr";
        s.sock = null;
        anotar(
          `conexão fechada (código ${code ?? "sem código"}): ${u.lastDisconnect?.error?.message ?? "sem mensagem"}` +
            ` | detalhe: ${JSON.stringify({
              nome: u.lastDisconnect?.error?.name,
              saida: u.lastDisconnect?.error?.output,
              dados: u.lastDisconnect?.error?.data,
              pilha: String(u.lastDisconnect?.error?.stack ?? "").split("\n").slice(0, 4).join(" <- "),
            })}`,
        );

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
          // O QR vence em ~1 min. Em vez de desistir, gera outro na hora
          // (o WhatsApp Web faz igual) por até 5 minutos de espera.
          if (s.ciclosQr < 5) {
            s.ciclosQr += 1;
            s.status = "connecting";
            setTimeout(() => {
              startSession(userId).catch((e) => console.error("[whatsapp] novo QR:", e));
            }, 500);
          } else {
            s.status = "disconnected";
            s.qrDataUrl = null;
            s.ciclosQr = 0;
            s.error = "Ninguém escaneou o QR code. Clique em Conectar para gerar outro.";
          }
          return;
        }
        // O WhatsApp derruba o aperto de mão (428) quando não aceita a versão
        // do protocolo que veio da internet. Tenta uma vez com a embutida.
        if (!wasQr && !s.qrDataUrl && !s.usarVersaoEmbutida && (code === 428 || code === 405)) {
          anotar("versão do protocolo recusada; tentando com a versão embutida");
          s.usarVersaoEmbutida = true;
          s.reconnects = 0;
          s.status = "connecting";
          s.conectandoDesde = Date.now();
          setTimeout(() => {
            startSession(userId).catch((e) => anotar(`falha ao reabrir: ${e?.message ?? e}`));
          }, 800);
          return;
        }

        // Credenciais salvas que nunca conseguem abrir = sessão velha inválida
        // (o aparelho foi desvinculado pelo celular). Começa do zero com QR.
        if (!s.jaAbriu && !wasQr && hasSavedLogin(userId) && s.reconnects >= 1) {
          anotar("sessão salva não abre; recomeçando com QR novo");
          wipeAuth(userId);
          s.reconnects = 0;
          s.status = "connecting";
          setTimeout(() => {
            startSession(userId).catch((e) => console.error("[whatsapp] reinício:", e));
          }, 500);
          return;
        }
        // Se o QR nunca chegou a aparecer, insistir não adianta: o problema é
        // a conexão com o WhatsApp, e ficar tentando só enche o log.
        const limite = s.jaAbriu || s.qrDataUrl ? 5 : 2;
        if (s.reconnects < limite) {
          s.reconnects += 1;
          s.status = "connecting";
          s.conectandoDesde = Date.now();
          setTimeout(() => {
            startSession(userId).catch((e) => anotar(`reconexão: ${e?.message ?? e}`));
          }, 1500);
        } else {
          s.status = "disconnected";
          if (s.vigia) { clearTimeout(s.vigia); s.vigia = null; }
          s.conectandoDesde = null;
          s.error =
            s.jaAbriu || s.qrDataUrl
              ? `A conexão caiu (código ${code ?? "?"}). Clique em Conectar para tentar de novo.`
              : `O WhatsApp encerrou a conexão (código ${code ?? "?"}) antes de gerar o QR code. Normalmente é o antivírus, o firewall ou a rede do computador bloqueando o acesso a web.whatsapp.com. Tente em outra rede (ou com o antivírus desligado) e clique em Conectar.`;
        }
      }
    });

    sock.ev.on("messaging-history.set", ({ chats, messages, contacts }: any) => {
      for (const c of contacts ?? []) registrarNome(s, c.id, c.name ?? c.notify ?? c.verifiedName);
      for (const c of chats ?? []) upsertChatInfo(s, c);
      for (const m of messages ?? []) addMessage(s, m, false);
      markDirty(s);
      console.log(`[whatsapp] histórico recebido: ${chats?.length ?? 0} conversas, ${messages?.length ?? 0} mensagens`);
    });

    sock.ev.on("chats.upsert", (chats: any[]) => {
      for (const c of chats ?? []) upsertChatInfo(s, c);
      markDirty(s);
    });

    sock.ev.on("chats.update", (updates: any[]) => {
      for (const u of updates ?? []) {
        const chat = u?.id ? s.chats.get(u.id) : null;
        if (!chat) continue;
        if (typeof u.unreadCount === "number" && u.unreadCount >= 0) chat.unread = u.unreadCount;
        if (u.conversationTimestamp) chat.timestamp = Math.max(chat.timestamp, toMillis(u.conversationTimestamp));
      }
      markDirty(s);
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
      markDirty(s);
    });

    sock.ev.on("contacts.upsert", (contacts: any[]) => {
      for (const c of contacts ?? []) registrarNome(s, c.id, c.name ?? c.notify ?? c.verifiedName);
      markDirty(s);
    });

    sock.ev.on("contacts.update", (contacts: any[]) => {
      for (const c of contacts ?? []) registrarNome(s, c.id, c.name ?? c.notify ?? c.verifiedName);
      markDirty(s);
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
  await loadStore(s);
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
  if (s) markDirty(s);
  try {
    const last = s?.messages.get(chatId)?.filter((m) => !m.fromMe).slice(-1)[0];
    if (s?.sock && last) {
      s.sock.readMessages([{ remoteJid: chatId, id: last.id, fromMe: false }]).catch(() => {});
    }
  } catch {
    /* ignora */
  }
}

/** Pede ao celular mensagens mais antigas da conversa (chegam via messaging-history.set). */
export async function loadOlder(userId: string, chatId: string, count = 50) {
  const s = requireConnected(userId);
  const oldest = s.messages.get(chatId)?.[0];
  if (!oldest) throw new Error("Não há mensagens nesta conversa para buscar as anteriores.");
  await s.sock.fetchMessageHistory(
    count,
    { remoteJid: chatId, id: oldest.id, fromMe: oldest.fromMe },
    Math.floor(oldest.timestamp / 1000),
  );
}

/** Foto de perfil (URL do CDN do WhatsApp) com cache de 6h. `null` = sem foto/privada. */
export async function getAvatar(userId: string, jid: string): Promise<string | null> {
  const s = sessions.get(userId);
  if (!s?.sock) return null;
  const cached = s.avatars.get(jid);
  if (cached && Date.now() - cached.at < AVATAR_TTL) return cached.url;
  const chat = s.chats.get(jid);
  if (chat && !chat.pnJid) await resolvePn(s, chat);
  const alvos = [chat?.pnJid, jid].filter((x, i, a): x is string => !!x && a.indexOf(x) === i);
  let url: string | null = null;
  for (const alvo of alvos) {
    try {
      url = (await s.sock.profilePictureUrl(alvo, "preview", 8000)) ?? null;
    } catch {
      url = null;
    }
    if (url) break;
  }
  s.avatars.set(jid, { url, at: Date.now() });
  return url;
}

function mediaDir(userId: string) {
  return path.join(authDir(userId), "..", "_media", userId.replace(/[^a-zA-Z0-9_-]/g, "_"));
}

function mediaPath(userId: string, msgId: string) {
  return path.join(mediaDir(userId), msgId.replace(/[^a-zA-Z0-9_-]/g, "_"));
}

function saveMediaCache(userId: string, msgId: string, buffer: Buffer) {
  try {
    fs.mkdirSync(mediaDir(userId), { recursive: true });
    fs.writeFileSync(mediaPath(userId, msgId), buffer);
  } catch (e) {
    console.error("[whatsapp] cache de mídia:", e);
  }
}

/** Baixa a mídia (foto, vídeo, áudio, documento) de uma mensagem, com cache em disco. */
export async function getMedia(userId: string, msgId: string) {
  const s = sessions.get(userId);
  const raw = s?.raw.get(msgId);
  const parsed = raw ? parseMessage(raw.message) : null;
  const meta = (() => {
    if (parsed) return parsed;
    for (const list of s?.messages.values() ?? []) {
      const m = list.find((x) => x.id === msgId);
      if (m) return m;
    }
    return null;
  })();
  const info = { mimetype: meta?.mimetype ?? "application/octet-stream", fileName: meta?.fileName };

  const cachePath = mediaPath(userId, msgId);
  if (fs.existsSync(cachePath)) return { buffer: fs.readFileSync(cachePath), ...info };
  if (!s || !raw) return null;

  const B = await loadBaileys();
  const ctx = { logger: pino({ level: "silent" }), reuploadRequest: (m: any) => s.sock.updateMediaMessage(m) };
  let buffer: Buffer;
  try {
    buffer = await B.downloadMediaMessage(raw, "buffer", {}, ctx);
  } catch (e: any) {
    // Link de mídia expirado: pede ao celular para reenviar e tenta de novo.
    console.warn(`[whatsapp] mídia ${msgId}: ${e?.message ?? e} — tentando reenvio`);
    if (!s.sock) throw e;
    const atualizado = await s.sock.updateMediaMessage(raw);
    buffer = await B.downloadMediaMessage(atualizado, "buffer", {}, ctx);
  }
  saveMediaCache(userId, msgId, buffer);
  return { buffer, ...info };
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
  if (sent?.key?.id) saveMediaCache(userId, sent.key.id, buffer);
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
    s.names.clear();
    if (s.saveTimer) clearTimeout(s.saveTimer);
    s.saveTimer = null;
  }
  wipeAuth(userId);
  try {
    fs.rmSync(storePath(userId), { force: true });
  } catch {
    /* ignora */
  }
}
