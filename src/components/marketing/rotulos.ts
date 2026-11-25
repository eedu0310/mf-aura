/**
 * Nomes e cores das situações de lead, campanha e postagem, num lugar só.
 * Antes cada tela tinha a sua cópia, e o "lead frio" (migração 102) ficou de
 * fora de uma delas: o selo aparecia vazio.
 */
import type { Tom } from "@/components/ui";
import type { StatusLead } from "@/lib/supabase/leads";
import type { StatusCampanha } from "@/lib/supabase/campanhas-marketing";
import type { StatusPostagem } from "@/lib/supabase/postagens-marketing";

export const STATUS_LEAD: Record<StatusLead, { texto: string; tom: Tom }> = {
  aguardando_sdr: { texto: "Em qualificação", tom: "atencao" },
  atribuido_sdr: { texto: "Com o SDR", tom: "marca" },
  repassado_vendedor: { texto: "Com o vendedor", tom: "marca" },
  respondido: { texto: "Respondido", tom: "sucesso" },
  lead_frio: { texto: "Lead frio", tom: "neutro" },
  perdido: { texto: "Perdido", tom: "perigo" },
};

/** Lead que ainda não teve resposta de ninguém. */
export function leadSemResposta(status: StatusLead) {
  return status === "aguardando_sdr" || status === "atribuido_sdr";
}

export const STATUS_CAMPANHA: Record<StatusCampanha, { texto: string; tom: Tom }> = {
  ativa: { texto: "Ativa", tom: "sucesso" },
  planejada: { texto: "Planejada", tom: "marca" },
  pausada: { texto: "Pausada", tom: "atencao" },
  encerrada: { texto: "Encerrada", tom: "neutro" },
};

export const STATUS_POSTAGEM: Record<StatusPostagem, { texto: string; tom: Tom; ponto: string }> = {
  planejado: { texto: "Planejada", tom: "neutro", ponto: "bg-aura-graphite-soft" },
  aguardando_aprovacao: { texto: "Aguardando aprovação", tom: "atencao", ponto: "bg-aura-warning" },
  aprovado: { texto: "Aprovada", tom: "marca", ponto: "bg-aura-petrol-500" },
  publicado: { texto: "Publicada", tom: "sucesso", ponto: "bg-aura-success" },
  rejeitado: { texto: "Rejeitada", tom: "perigo", ponto: "bg-aura-danger" },
};

const FORMATO_DIA_HORA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/** "24/11, 14:32" no horário de Brasília. */
export function diaHora(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : FORMATO_DIA_HORA.format(d);
}

/** "há 5 min", "há 3h", "há 2d". */
export function tempoRelativo(data: Date) {
  const min = Math.floor((Date.now() - data.getTime()) / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

/** Data "AAAA-MM-DD" do banco para "DD/MM/AAAA", sem passar por fuso. */
export function dataCurta(iso: string | null | undefined) {
  if (!iso) return "";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export function moeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(valor);
}
