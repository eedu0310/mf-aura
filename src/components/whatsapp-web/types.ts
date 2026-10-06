import type { CategoriaContato, NaturezaContato } from "@/lib/categoria-contato";

export type WaStatus = "disconnected" | "connecting" | "qr" | "connected";
export type WaMsgType = "text" | "image" | "video" | "audio" | "document" | "sticker" | "location" | "contact";
// A etapa é texto livre: o funil é editável pelo gestor. Quem diz o que cada
// etapa significa é @/lib/funil, pelo papel dela.
export type { Etapa } from "@/lib/funil";
import type { Etapa } from "@/lib/funil";

export interface WaChat {
  id: string;
  pnJid: string | null;
  hasName: boolean;
  name: string;
  phone: string;
  lastMessage: string;
  lastFromMe: boolean;
  lastType: WaMsgType;
  timestamp: number;
  unread: number;
}

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
  status?: number;
  /** Reações nesta mensagem, por emoji. `minha` deixa o botão marcado. */
  reacoes?: { emoji: string; total: number; minha: boolean }[];
}

export interface Alerta {
  tipo: "sem_resposta" | "follow_up" | "risco_perda";
  nivel: "medio" | "alto" | "critico";
  texto: string;
  desde: number;
}

export interface LeadResumo {
  etapa: Etapa | null;
  ignorado: boolean;
  lead: boolean;
  /** O que o contato é: lead, não-lead ou cliente da casa. */
  natureza?: NaturezaContato | null;
  /** Vira a etiqueta ao lado do nome na lista de conversas. */
  categoria?: CategoriaContato | null;
}

export interface WaState {
  userId: string;
  status: WaStatus;
  qrCode: string | null;
  phone: string | null;
  name: string | null;
  myJid: string | null;
  error: string | null;
  chats: WaChat[];
  leads: Record<string, LeadResumo>;
  alertas: Record<string, Alerta[]>;
  iaDisponivel: boolean;
}

export interface LeadInfo {
  /** A AURA achou que pode ser lead, mas não teve certeza: espera confirmação. */
  leadSugerido?: boolean;
  motivoSugestao?: string | null;
  chatJid: string;
  ehLead: boolean;
  ignorado: boolean;
  natureza?: NaturezaContato | null;
  categoria?: CategoriaContato | null;
  motivoNatureza?: string | null;
  /** Palpite da AURA, para o vendedor só confirmar. Não vale como decisão. */
  categoriaSugerida?: CategoriaContato | null;
  etapa: Etapa | null;
  etapaPipeline: Etapa | null;
  oportunidadeId: string | null;
  relacionamentoId: string | null;
  resumo: string | null;
  proximaAcao: string | null;
  sugestaoResposta: string | null;
  interesse: string | null;
  valorEstimado: number | null;
  dicas: string[];
  alertasIa: string[];
  historico: { em: string; de: string | null; para: string; evidencia: string; fonte: string }[];
  ultimaAnaliseEm: string | null;
  analisando: boolean;
  iaDisponivel: boolean;
  aviso: string | null;
}

export const API = "/api/whatsapp/live";

/**
 * As cores das etiquetas de etapa vêm do funil da loja (coluna "cor"), que o
 * gestor escolhe. Aqui fica só o fundo escuro que combina com a tela do
 * WhatsApp, calculado a partir da cor dela.
 */
export function estiloDaEtapa(cor: string): { backgroundColor: string; color: string } {
  return { backgroundColor: `${cor}26`, color: cor };
}

export function formatPhone(phone: string) {
  const d = (phone || "").replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4);
    const rest = d.slice(4);
    return `+55 ${ddd} ${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`;
  }
  return phone;
}

export function formatHour(ts: number) {
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function formatListTime(ts: number) {
  if (!ts) return "";
  const d = new Date(ts);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === hoje.toDateString()) return formatHour(ts);
  if (d.toDateString() === ontem.toDateString()) return "Ontem";
  if (hoje.getTime() - ts < 6 * 86400e3) return d.toLocaleDateString("pt-BR", { weekday: "long" });
  return d.toLocaleDateString("pt-BR");
}

export function formatDayLabel(ts: number) {
  const d = new Date(ts);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === hoje.toDateString()) return "HOJE";
  if (d.toDateString() === ontem.toDateString()) return "ONTEM";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export async function postJson(payload: Record<string, unknown>) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Erro ${res.status}`);
  return data;
}
