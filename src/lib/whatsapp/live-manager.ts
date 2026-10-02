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

/** A mensagem que esta sendo respondida, como o WhatsApp mostra acima do texto. */
export interface WaQuote {
  id: string;
  text: string;
  type: WaMsgType;
  fromMe: boolean;
}

export interface WaMessage {
  id: string;
  chatId: string;
  quoted?: WaQuote;
  fromMe: boolean;
  text: string;
  timestamp: number;
  type: WaMsgType;
  hasMedia: boolean;
  mimetype?: string;
  fileName?: string;
  /** 0 erro · 1 pendente · 2 enviado (✓) · 3 entregue (✓✓) · 4 lido (✓✓ azul) */
  status?: number;
  /**
   * Reacoes nesta mensagem, por emoji. `minha` diz se a nossa esta entre elas,
   * para o botao aparecer marcado.
   *
   * O WhatsApp manda reacao como uma MENSAGEM propria, apontando para a
   * mensagem alvo. Antes elas eram descartadas (o parser devolvia nulo), ou
   * seja: o cliente reagia e o vendedor nunca via.
   */
  reacoes?: { emoji: string; total: number; minha: boolean }[];
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
  /** Conexão enxuta (sem histórico completo), quando a completa é recusada. */
  modoSimples: boolean;
  chats: Map<string, WaChat>;
  messages: Map<string, WaMessage[]>;
  raw: Map<string, any>;
  /** O @lid novo do WhatsApp apontando para o JID do numero da mesma pessoa. */
  lidParaPn: Map<string, string>;
  avatars: Map<string, { url: string | null; at: number }>;
  /** Nomes da agenda/pushName por JID (para conversas que chegam sem nome). */
  names: Map<string, string>;
  storeLoaded: boolean;
  saveTimer: ReturnType<typeof setTimeout> | null;
}

type MessageListener = (userId: string, chatId: string, msg: WaMessage) => void;

// Esta pasta guarda a sessão do WhatsApp e as conversas em disco. O caminho é
// montado em tempo de execução; o comentário abaixo impede que o empacotador
// tente rastrear o conteúdo dela e acabe embutindo milhares de arquivos no
// pacote do servidor.
const SESSIONS_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), ".whatsapp-sessions");
const MAX_MSGS_PER_CHAT = 400;
const MAX_RAW = 3000;
const AVATAR_TTL = 6 * 60 * 60 * 1000;
/** Quando não veio foto, tentamos de novo bem antes das 6h: no contato que não
 *  está salvo a primeira busca falha com frequência (o pnJid ainda não foi
 *  resolvido, ou o WhatsApp recusa a foto naquele instante). Guardar esse "sem
 *  foto" por 6 horas deixava o vendedor sem a imagem o resto do dia — e é pela
 *  imagem que ele localiza o cliente. */
const AVATAR_TTL_VAZIO = 15 * 60 * 1000;

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
  return path.join(/*turbopackIgnore: true*/ SESSIONS_DIR, userId.replace(/[^a-zA-Z0-9_-]/g, "_"));
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
    fs.appendFileSync(path.join(/*turbopackIgnore: true*/ SESSIONS_DIR, "diagnostico.log"), linha + "\n");
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
      modoSimples: false,
      chats: new Map(),
      messages: new Map(),
      raw: new Map(),
      lidParaPn: new Map(),
      avatars: new Map(),
      names: new Map(),
      storeLoaded: false,
      saveTimer: null,
    };
    sessions.set(userId, s);
  }
  s.raw ??= new Map();
  s.lidParaPn ??= new Map();
  s.avatars ??= new Map();
  s.names ??= new Map();
  s.ciclosQr ??= 0;
  s.jaAbriu ??= false;
  s.vigia ??= null;
  s.usarVersaoEmbutida ??= false;
  s.modoSimples ??= false;
  // Sessão que ficou de uma versão anterior do código não tem o carimbo de
  // hora. Sem isso ela ficaria presa em "conectando" para sempre.
  if (s.conectandoDesde === undefined) s.conectandoDesde = s.status === "connecting" ? 0 : null;
  return s;
}

// ------------------------------------------------------------------ persistência
// As conversas ficam salvas em disco: o WhatsApp só manda o histórico uma vez
// (quando o aparelho é conectado), então sem isso tudo sumia ao reiniciar.

function storePath(userId: string) {
  return path.join(/*turbopackIgnore: true*/ SESSIONS_DIR, "_store", `${userId.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
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
    for (const [lid, pn] of Object.entries(data.lidParaPn ?? {}) as [string, string][]) s.lidParaPn.set(lid, pn);

    // Conversas que ja estavam partidas em duas antes desta correcao: o par
    // esta gravado em cada uma, basta usa-lo para juntar.
    for (const chat of Array.from(s.chats.values())) {
      if (chat.id.endsWith("@lid") && chat.pnJid) lembrarLid(s, chat.id, chat.pnJid);
    }
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
    lidParaPn: Object.fromEntries(s.lidParaPn),
    names: Object.fromEntries(s.names),
  };
  const tmp = `${file}.tmp`;
  await fs.promises.writeFile(tmp, JSON.stringify(data, B.BufferJSON?.replacer));
  await fs.promises.rename(tmp, file);
}

function upsertChatInfo(s: WaSession, c: any) {
  const jidBruto: string | undefined = c?.id;
  if (!jidBruto || isIgnoredJid(jidBruto)) return;
  const pnJid: string | null = jidBruto.endsWith("@s.whatsapp.net")
    ? jidBruto
    : typeof c.pnJid === "string" && c.pnJid.endsWith("@s.whatsapp.net")
    ? c.pnJid
    : null;
  // Aprender o par ANTES de mexer na conversa: senao juntamos as duas e em
  // seguida recriamos a do @lid, do jeito que estava.
  if (jidBruto.endsWith("@lid") && pnJid) lembrarLid(s, jidBruto, pnJid);
  const jid = jidCanonico(s, jidBruto);
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

/**
 * A mensagem que esta sendo respondida.
 *
 * O WhatsApp manda isso no `contextInfo` de qualquer tipo de mensagem, nao
 * num campo proprio — por isso a busca varre os blocos ate achar um que
 * traga `quotedMessage`.
 */
function contextoDe(m: any): any {
  for (const chave of Object.keys(m ?? {})) {
    const ctx = m?.[chave]?.contextInfo;
    if (ctx?.quotedMessage) return ctx;
  }
  return null;
}

function citacaoDe(m: any, s: WaSession, jid: string): WaMessage["quoted"] {
  const ctx = contextoDe(m);
  if (!ctx) return undefined;
  const citada = parseMessage(ctx.quotedMessage);
  if (!citada) return undefined;
  const id = String(ctx.stanzaId ?? "");
  // Quem escreveu a citada: se ela esta na nossa lista, ela manda; senao
  // vale o participant que veio no contexto.
  const guardada = id ? s.messages.get(jid)?.find((m2) => m2.id === id) : undefined;
  return {
    id,
    text: citada.text || previewOf(citada),
    type: citada.type,
    fromMe: guardada ? guardada.fromMe : Boolean(ctx.participant && ctx.participant === s.jid),
  };
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


/**
 * A mesma pessoa, uma conversa so.
 *
 * O WhatsApp esta trocando o identificador do contato: alem do JID com o
 * numero (5554...@s.whatsapp.net) existe agora o @lid. A mesma pessoa chega
 * ora por um, ora pelo outro — e o AURA abria DUAS conversas para ela, cada
 * uma com metade das mensagens. Foi o que aconteceu quando o mesmo contato
 * respondeu de outro aparelho.
 *
 * O numero manda: e o que vale para o CRM, para o cadastro do cliente e para
 * iniciar conversa. Quando descobrimos o par, o @lid passa a apontar para
 * ele e o que ja estava separado e juntado.
 */
function jidCanonico(s: WaSession, jid: string): string {
  return (jid.endsWith("@lid") && s.lidParaPn.get(jid)) || jid;
}

function lembrarLid(s: WaSession, lid: string, pnJid: string) {
  if (!lid.endsWith("@lid") || !pnJid.endsWith("@s.whatsapp.net")) return;
  if (s.lidParaPn.get(lid) === pnJid) return;
  s.lidParaPn.set(lid, pnJid);
  juntarConversas(s, lid, pnJid);
}

/** Move o que estava sob o @lid para a conversa do numero. */
function juntarConversas(s: WaSession, de: string, para: string) {
  if (de === para) return;
  const antiga = s.chats.get(de);
  const msgsAntigas = s.messages.get(de) ?? [];

  if (msgsAntigas.length) {
    const juntas = [...(s.messages.get(para) ?? [])];
    const vistos = new Set(juntas.map((m) => m.id));
    for (const m of msgsAntigas) {
      if (vistos.has(m.id)) continue;
      vistos.add(m.id);
      juntas.push({ ...m, chatId: para });
    }
    juntas.sort((a, b) => a.timestamp - b.timestamp);
    if (juntas.length > MAX_MSGS_PER_CHAT) juntas.splice(0, juntas.length - MAX_MSGS_PER_CHAT);
    s.messages.set(para, juntas);
  }
  s.messages.delete(de);

  if (antiga) {
    const atual = s.chats.get(para);
    if (!atual) {
      s.chats.set(para, { ...antiga, id: para, pnJid: para });
    } else {
      atual.unread += antiga.unread;
      // O nome de verdade vence o "+55 54 ..." montado a partir do numero.
      if (!atual.hasName && antiga.hasName) {
        atual.name = antiga.name;
        atual.hasName = true;
      }
      if (antiga.timestamp > atual.timestamp) {
        atual.timestamp = antiga.timestamp;
        atual.lastMessage = antiga.lastMessage;
        atual.lastFromMe = antiga.lastFromMe;
        atual.lastType = antiga.lastType;
      }
    }
    s.chats.delete(de);
  }
  markDirty(s);
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
      lembrarLid(s, chat.id, pnJid);
    }
  } catch {
    /* sem mapeamento ainda */
  }
}

/**
 * Carimba (ou retira) uma reacao na mensagem alvo.
 *
 * Emoji vazio significa que a pessoa DESFEZ a reacao - e assim que o WhatsApp
 * avisa. Sem tratar esse caso, a reacao removida ficava na tela para sempre.
 */
function aplicarReacao(s: WaSession, jid: string, reacao: any, minha: boolean) {
  const alvo: string | undefined = reacao?.key?.id;
  if (!alvo) return;
  const msg = s.messages.get(jid)?.find((m) => m.id === alvo);
  if (!msg) return;

  const emoji = String(reacao.text ?? "").trim();
  const atuais = msg.reacoes ?? [];

  // Cada pessoa tem uma reacao por mensagem: a nova substitui a anterior dela.
  const semAMinha = atuais
    .map((r) => (minha && r.minha ? { ...r, total: r.total - 1, minha: false } : r))
    .filter((r) => r.total > 0);

  if (!emoji) {
    msg.reacoes = semAMinha.length ? semAMinha : undefined;
    markDirty(s);
    return;
  }

  const achada = semAMinha.find((r) => r.emoji === emoji);
  if (achada) {
    achada.total += 1;
    achada.minha = achada.minha || minha;
  } else {
    semAMinha.push({ emoji, total: 1, minha });
  }
  msg.reacoes = semAMinha;
  markDirty(s);
}

function toMillis(ts: any): number {
  if (!ts) return Date.now();
  const n = typeof ts === "number" ? ts : Number(ts?.toString?.() ?? ts);
  return Number.isFinite(n) && n > 0 ? n * 1000 : Date.now();
}

function addMessage(s: WaSession, msg: any, live: boolean) {
  const jidBruto: string | undefined = msg?.key?.remoteJid;
  if (!jidBruto || isIgnoredJid(jidBruto)) return;

  // Reacao nao e mensagem: e um carimbo numa mensagem que ja existe.
  const reacao = unwrap(msg.message)?.reactionMessage;
  if (reacao) {
    aplicarReacao(s, jidCanonico(s, jidBruto), reacao, !!msg.key.fromMe);
    return;
  }

  const parsed = parseMessage(msg.message);
  if (!parsed) return;

  // A propria mensagem costuma trazer os dois identificadores da pessoa.
  // Aproveitamos para aprender o par e manter tudo numa conversa so.
  const altJid: string | undefined = msg.key.remoteJidAlt ?? msg.key.senderPn;
  if (jidBruto.endsWith("@lid") && altJid?.endsWith("@s.whatsapp.net")) lembrarLid(s, jidBruto, altJid);
  const jid = jidCanonico(s, jidBruto);

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
  const citacao = citacaoDe(unwrap(msg.message), s, jid);
  if (citacao) item.quoted = citacao;

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
    // registrarNome grava no mapa s.names, que é persistido em disco. Antes
    // isto só escrevia em chat.name: o pré-nome do contato não salvo aparecia
    // enquanto a sessão vivia e, ao reiniciar, a conversa voltava a mostrar o
    // número cru. Registramos também sob o pnJid porque a conversa pode estar
    // indexada por @lid e o nome precisa ser achado pelos dois caminhos.
    registrarNome(s, jid, msg.pushName);
    if (chat.pnJid) registrarNome(s, chat.pnJid, msg.pushName);
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

export async function startSession(
  userId: string,
  /** true quando foi o usuário que clicou em Conectar (e não um religamento). */
  porPedidoDoUsuario = false,
): Promise<WaSession> {
  const s = getOrCreate(userId);
  // Só o clique do usuário desfaz um "desconectar" pedido por ele.
  if (porPedidoDoUsuario) s.manualStop = false;
  if (s.manualStop) return s;

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
    anotar(`abrindo conexão (versão ${version ? version.join(".") : "embutida"}, modo ${s.modoSimples ? "simples" : "completo"})`);

    const sock = B.makeWASocket({
      auth: state,
      // Só manda a versão quando ela existe: passar `undefined` faz a
      // biblioteca quebrar em vez de usar a versão que ela já traz.
      ...(version ? { version } : {}),
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      // O WhatsApp recusa a conexão (código 428) quando o cliente se apresenta
      // como "Desktop"; identificando-se como um navegador comum, ele aceita.
      // syncFullHistory pede o histórico completo de conversas ao parear — se
      // for isso que o servidor recusar, o modo simples entra sem ele.
      browser: B.Browsers?.ubuntu ? B.Browsers.ubuntu("Chrome") : ["Chrome (Linux)", "Chrome", "120.0.0"],
      ...(s.modoSimples ? {} : { syncFullHistory: true }),
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
            if (s.manualStop) return;
            startSession(userId).catch((e) => anotar(`falha ao reabrir: ${e?.message ?? e}`));
          }, 800);
          return;
        }

        // Última cartada antes de desistir: conectar como um navegador comum,
        // sem pedir o histórico completo.
        if (!wasQr && !s.qrDataUrl && !s.modoSimples && (code === 428 || code === 405)) {
          anotar("pedido de histórico completo recusado; tentando sem ele");
          s.modoSimples = true;
          s.reconnects = 0;
          s.status = "connecting";
          s.conectandoDesde = Date.now();
          setTimeout(() => {
            if (s.manualStop) return;
            startSession(userId).catch((e) => anotar(`falha no modo simples: ${e?.message ?? e}`));
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
            if (s.manualStop) return;
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
            if (s.manualStop) return;
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

    /**
     * Tiques de enviado / entregue / lido.
     *
     * O WhatsApp avisa por DOIS caminhos e o codigo escutava so um. Alem de
     * "messages.update" com o status, vem "message-receipt.update" com o
     * carimbo de entrega e de leitura — em muitas contas e so por ele que o
     * recibo chega, e por isso a mensagem ficava no reloginho para sempre.
     *
     * A conversa tambem precisa ser a canonica: o recibo chega pelo @lid e a
     * mensagem esta guardada sob o numero.
     */
    const marcarStatus = (key: any, status: number) => {
      if (!key?.remoteJid || !Number.isFinite(status)) return false;
      const jid = jidCanonico(s, key.remoteJid);
      const msg =
        s.messages.get(jid)?.find((m) => m.id === key.id) ??
        s.messages.get(key.remoteJid)?.find((m) => m.id === key.id);
      if (!msg || !msg.fromMe || status <= (msg.status ?? 0)) return false;
      msg.status = status;
      return true;
    };

    sock.ev.on("messages.update", (updates: any[]) => {
      let mudou = false;
      for (const { key, update } of updates ?? []) {
        if (typeof update?.status === "number" && marcarStatus(key, update.status)) mudou = true;
      }
      if (mudou) markDirty(s);
    });

    sock.ev.on("message-receipt.update", (updates: any[]) => {
      let mudou = false;
      for (const { key, receipt } of updates ?? []) {
        // readTimestamp vence: lido (4) esta acima de entregue (3).
        const status = receipt?.readTimestamp ? 4 : receipt?.receiptTimestamp ? 3 : null;
        if (status && marcarStatus(key, status)) mudou = true;
      }
      if (mudou) markDirty(s);
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

/**
 * Marca a conversa como NAO lida, como no WhatsApp Business.
 *
 * Serve de recado para si mesmo: "volto aqui". Por isso o aviso tambem sobe
 * para o celular (chatModify), senao o vendedor marcaria no CRM e o aparelho
 * continuaria dizendo que esta lida - duas verdades para a mesma conversa.
 *
 * Se o celular recusar, a marca local continua valendo: e melhor a marca
 * funcionar so aqui do que nao funcionar.
 */
export async function marcarNaoLida(userId: string, chatId: string) {
  const s = sessions.get(userId);
  if (!s) throw new Error("Sessão do WhatsApp não encontrada.");
  const chat = s.chats.get(chatId);
  if (chat && chat.unread < 1) chat.unread = 1;
  markDirty(s);

  try {
    const ultima = s.messages.get(chatId)?.slice(-1)[0];
    if (s.sock && ultima) {
      await s.sock.chatModify(
        {
          markRead: false,
          lastMessages: [
            {
              key: { remoteJid: chatId, id: ultima.id, fromMe: ultima.fromMe },
              messageTimestamp: Math.floor(ultima.timestamp / 1000),
            },
          ],
        },
        chatId,
      );
    }
  } catch (e: any) {
    console.error("[whatsapp] marcar nao lida no aparelho:", e?.message ?? e);
  }
  return { chatId, unread: s.chats.get(chatId)?.unread ?? 1 };
}

/**
 * Reage a uma mensagem com emoji, como no WhatsApp Business.
 *
 * Emoji vazio desfaz a reacao - e o mesmo protocolo que o aparelho usa, entao
 * tirar e so reagir com "".
 */
export async function reagir(userId: string, chatId: string, msgId: string, emoji: string) {
  const s = requireConnected(userId);
  const msg = s.messages.get(chatId)?.find((m) => m.id === msgId);
  if (!msg) throw new Error("Mensagem não encontrada nesta conversa.");

  await s.sock.sendMessage(chatId, {
    react: { text: emoji, key: { remoteJid: chatId, id: msgId, fromMe: msg.fromMe } },
  });

  // O aparelho nao devolve a nossa propria reacao, entao carimbamos aqui para
  // a tela responder na hora em vez de esperar um eco que nao vem.
  aplicarReacao(s, chatId, { key: { id: msgId }, text: emoji }, true);
  return { ok: true };
}

/**
 * Encaminha uma mensagem para outras conversas, como no WhatsApp Business.
 *
 * Midia (foto, video, documento) fica guardada inteira em `s.raw` e e
 * encaminhada de verdade, com o selo "Encaminhada" e sem reenviar o arquivo.
 * Texto NAO fica guardado inteiro: para ele remontamos o minimo que o
 * WhatsApp aceita, do mesmo jeito que a citacao faz.
 *
 * Devolve o que deu certo e o que falhou por destino, em vez de parar no
 * primeiro erro: encaminhar para cinco e falhar em um nao pode perder os
 * outros quatro.
 */
export async function encaminhar(
  userId: string,
  deChatId: string,
  msgId: string,
  paraChatIds: string[],
) {
  const s = requireConnected(userId);
  const guardada = s.messages.get(deChatId)?.find((m) => m.id === msgId);
  if (!guardada) throw new Error("Mensagem não encontrada nesta conversa.");

  const raw = s.raw.get(msgId);
  const original =
    raw?.key && raw?.message
      ? raw
      : {
          key: { remoteJid: deChatId, fromMe: guardada.fromMe, id: msgId },
          message: { conversation: guardada.text || previewOf(guardada) },
        };

  const enviados: string[] = [];
  const falhas: { chatId: string; motivo: string }[] = [];

  for (const destino of paraChatIds) {
    try {
      const jid = await resolveJid(s, destino);
      const sent = await s.sock.sendMessage(jid, { forward: original });
      await afterSend(s, jid, sent);
      enviados.push(jid);
    } catch (e: any) {
      falhas.push({ chatId: destino, motivo: e?.message ?? "falha ao encaminhar" });
    }
  }

  if (!enviados.length) {
    throw new Error(falhas[0]?.motivo ?? "Não consegui encaminhar para nenhuma conversa.");
  }
  return { enviados, falhas };
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
  const ttl = cached?.url ? AVATAR_TTL : AVATAR_TTL_VAZIO;
  if (cached && Date.now() - cached.at < ttl) return cached.url;
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
  return path.join(/*turbopackIgnore: true*/ authDir(userId), "..", "_media", userId.replace(/[^a-zA-Z0-9_-]/g, "_"));
}

function mediaPath(userId: string, msgId: string) {
  return path.join(/*turbopackIgnore: true*/ mediaDir(userId), msgId.replace(/[^a-zA-Z0-9_-]/g, "_"));
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

/**
 * Monta o `quoted` que o Baileys espera para responder uma mensagem.
 *
 * So mensagem com midia fica guardada inteira em `s.raw` — texto, nao. Para
 * o texto, o par { key, message } e remontado a partir do que ja esta na
 * conversa, que e tudo que o WhatsApp precisa para mostrar a citacao.
 */
function paraCitar(s: WaSession, jid: string, quotedId?: string | null) {
  if (!quotedId) return undefined;
  const raw = s.raw.get(quotedId);
  if (raw?.key && raw?.message) return raw;
  const guardada = s.messages.get(jid)?.find((m) => m.id === quotedId);
  if (!guardada) return undefined;
  return {
    key: { remoteJid: jid, fromMe: guardada.fromMe, id: quotedId },
    message: { conversation: guardada.text || previewOf(guardada) },
  };
}

export async function sendText(userId: string, to: string, text: string, quotedId?: string | null) {
  const s = requireConnected(userId);
  const jid = await resolveJid(s, to);
  const quoted = paraCitar(s, jid, quotedId);
  const sent = await s.sock.sendMessage(jid, { text }, quoted ? { quoted } : undefined);
  await afterSend(s, jid, sent);
  return { chatId: jid };
}

export async function sendFile(
  userId: string,
  to: string,
  file: { buffer: Buffer; mimetype: string; fileName: string },
  caption?: string,
  opts?: { quotedId?: string | null; ptt?: boolean },
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
    // ptt = a bolinha de voz do WhatsApp, com onda e play, em vez de um
    // arquivo anexado. O celular so a reconhece como Opus em OGG; o que o
    // navegador grava e convertido antes de chegar aqui.
    content = opts?.ptt
      ? { audio: buffer, mimetype: "audio/ogg; codecs=opus", ptt: true }
      : { audio: buffer, mimetype };
  } else {
    content = { document: buffer, mimetype, fileName, caption };
  }
  const quoted = paraCitar(s, jid, opts?.quotedId);
  const sent = await s.sock.sendMessage(jid, content, quoted ? { quoted } : undefined);
  if (sent?.key?.id) saveMediaCache(userId, sent.key.id, buffer);
  await afterSend(s, jid, sent);
  return { chatId: jid };
}

export async function logout(userId: string) {
  const s = sessions.get(userId);
  if (s) {
    s.manualStop = true;
    // Um novo pareamento começa do zero: volta a tentar a conexão completa
    // (com histórico) antes de cair para a simples.
    s.modoSimples = false;
    s.usarVersaoEmbutida = false;
    s.ciclosQr = 0;
    if (s.vigia) { clearTimeout(s.vigia); s.vigia = null; }
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
