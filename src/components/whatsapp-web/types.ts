export type WaStatus = "disconnected" | "connecting" | "qr" | "connected";
export type WaMsgType = "text" | "image" | "video" | "audio" | "document" | "sticker" | "location" | "contact";
export type Etapa = "Prospecção" | "Apresentação" | "Proposta" | "Negociação" | "Fechados" | "Perdidos";

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
  status?: number;
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
  chatJid: string;
  ehLead: boolean;
  ignorado: boolean;
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

export const ETAPAS_FUNIL: Etapa[] = ["Prospecção", "Apresentação", "Proposta", "Negociação", "Fechados"];

export const COR_ETAPA: Record<Etapa, string> = {
  Prospecção: "bg-slate-100 text-slate-700",
  Apresentação: "bg-sky-100 text-sky-700",
  Proposta: "bg-amber-100 text-amber-800",
  Negociação: "bg-orange-100 text-orange-800",
  Fechados: "bg-emerald-100 text-emerald-800",
  Perdidos: "bg-red-100 text-red-700",
};

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
