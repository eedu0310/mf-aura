/**
 * Relatório de atendimento dos leads: para cada lead que chegou na fila,
 * quando e como foi atendido, e se foi dentro do prazo.
 *
 * "Atendido" é o que aconteceu primeiro depois que o lead chegou:
 *  - a vendedora mandou mensagem pelo WhatsApp ligado na AURA (a AURA marca o
 *    lead como respondido e registra a atividade "Atendimento pelo WhatsApp");
 *  - a vendedora tocou em "Marcar como respondido";
 *  - a vendedora registrou uma atividade com o cliente (ligação, visita,
 *    orçamento...).
 * Atividade que a própria IA cria ao abrir a oportunidade NÃO conta: ela
 * aparece no mesmo minuto em que o lead chega e não é atendimento de ninguém.
 */
import type { Lead } from "@/lib/supabase/leads";

export const FUSO = "America/Sao_Paulo";

export type SituacaoAtendimento =
  | "no_prazo"
  | "fora_do_prazo"
  | "aguardando"
  | "atrasado"
  | "perdido_sem_atendimento";

export const SITUACAO_TEXTO: Record<SituacaoAtendimento, string> = {
  no_prazo: "Atendido no prazo",
  fora_do_prazo: "Atendido fora do prazo",
  aguardando: "Sem atendimento, no prazo",
  atrasado: "Sem atendimento, prazo vencido",
  perdido_sem_atendimento: "Perdido sem atendimento",
};

/** Atividade registrada com o cliente do lead (já sem as que a IA cria). */
export interface AtividadeDoLead {
  em: number;
  tipo: string;
  origem: string | null;
}

export interface LinhaAtendimento {
  lead: Lead;
  vendedorId: string;
  vendedor: string;
  chegouEm: Date;
  /** Dia de chegada no horário de Brasília, AAAA-MM-DD. */
  dia: string;
  atendidoEm: Date | null;
  como: string | null;
  minutosAteAtender: number | null;
  situacao: SituacaoAtendimento;
}

export interface ResumoAtendimento {
  chave: string;
  nome: string;
  recebidos: number;
  atendidos: number;
  noPrazo: number;
  foraDoPrazo: number;
  semAtendimento: number;
  atrasados: number;
  perdidos: number;
  /** Mediana dos minutos até o primeiro atendimento, dos atendidos. */
  medianaMinutos: number | null;
}

export const SEM_VENDEDOR = "sem-vendedor";

/** Quem cuida do lead: o vendedor, ou o SDR enquanto não foi repassado. */
export function donoDoLead(lead: Lead): string {
  return lead.vendedorId ?? lead.sdrId ?? SEM_VENDEDOR;
}

export function diaEmBrasilia(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: FUSO });
}

function comoFoiAtendido(origem: string | null, tipo: string): string {
  if (origem === "whatsapp_auto") return "WhatsApp pela AURA";
  return tipo ? `Atividade: ${tipo}` : "Atividade registrada";
}

export function montarLinhas(
  leads: Lead[],
  nomes: Map<string, string>,
  atividades: Map<string, AtividadeDoLead[]>,
  agora: number = Date.now(),
): LinhaAtendimento[] {
  return leads.map((lead) => {
    const chegou = new Date(lead.createdAt);
    const t0 = chegou.getTime();

    // O primeiro sinal de atendimento depois da chegada.
    let em: number | null = null;
    let como: string | null = null;
    if (lead.respondidoEm) {
      const r = new Date(lead.respondidoEm).getTime();
      if (Number.isFinite(r)) {
        em = Math.max(r, t0);
        como = lead.status === "lead_frio" ? "Classificado como lead frio" : "Marcado como respondido";
      }
    }
    const lista = lead.relacionamentoId ? atividades.get(lead.relacionamentoId) ?? [] : [];
    const primeira = lista.find((a) => a.em >= t0);
    if (primeira && (em === null || primeira.em <= em)) {
      em = primeira.em;
      como = comoFoiAtendido(primeira.origem, primeira.tipo);
    }

    const prazo = lead.prazoResposta ? new Date(lead.prazoResposta).getTime() : null;
    let situacao: SituacaoAtendimento;
    if (em !== null) {
      situacao = prazo === null || em <= prazo ? "no_prazo" : "fora_do_prazo";
    } else if (lead.status === "perdido") {
      situacao = "perdido_sem_atendimento";
    } else {
      situacao = prazo !== null && agora > prazo ? "atrasado" : "aguardando";
    }

    const vendedorId = donoDoLead(lead);
    return {
      lead,
      vendedorId,
      vendedor: vendedorId === SEM_VENDEDOR ? "Sem vendedor" : nomes.get(vendedorId) ?? "Vendedor sem nome",
      chegouEm: chegou,
      dia: diaEmBrasilia(chegou),
      atendidoEm: em === null ? null : new Date(em),
      como,
      minutosAteAtender: em === null ? null : Math.round((em - t0) / 60_000),
      situacao,
    };
  });
}

/** Período fechado, nas datas de Brasília (AAAA-MM-DD). Vazio = sem limite. */
export function noPeriodo(linhas: LinhaAtendimento[], inicio: string, fim: string) {
  return linhas.filter((l) => (!inicio || l.dia >= inicio) && (!fim || l.dia <= fim));
}

function mediana(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export function resumir(chave: string, nome: string, linhas: LinhaAtendimento[]): ResumoAtendimento {
  const atendidos = linhas.filter((l) => l.atendidoEm);
  return {
    chave,
    nome,
    recebidos: linhas.length,
    atendidos: atendidos.length,
    noPrazo: linhas.filter((l) => l.situacao === "no_prazo").length,
    foraDoPrazo: linhas.filter((l) => l.situacao === "fora_do_prazo").length,
    semAtendimento: linhas.length - atendidos.length,
    atrasados: linhas.filter((l) => l.situacao === "atrasado").length,
    perdidos: linhas.filter((l) => l.lead.status === "perdido").length,
    medianaMinutos: mediana(atendidos.map((l) => l.minutosAteAtender ?? 0)),
  };
}

/** Um resumo por vendedor, do que mais recebeu para o que menos recebeu. */
export function resumoPorVendedor(linhas: LinhaAtendimento[]): ResumoAtendimento[] {
  const grupos = new Map<string, LinhaAtendimento[]>();
  for (const l of linhas) {
    const g = grupos.get(l.vendedorId);
    if (g) g.push(l);
    else grupos.set(l.vendedorId, [l]);
  }
  return [...grupos.entries()]
    .map(([id, ls]) => resumir(id, ls[0].vendedor, ls))
    .sort((a, b) => b.recebidos - a.recebidos || a.nome.localeCompare(b.nome, "pt-BR"));
}

export function porcentagem(parte: number, todo: number): string {
  if (!todo) return "—";
  return `${Math.round((parte / todo) * 100)}%`;
}

export function formatarDuracao(min: number | null): string {
  if (min === null) return "—";
  if (min < 1) return "menos de 1 min";
  if (min < 60) return `${min} min`;
  if (min < 24 * 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  const d = Math.floor(min / (24 * 60));
  const h = Math.floor((min % (24 * 60)) / 60);
  return h ? `${d} d ${h} h` : `${d} d`;
}

export function dataHoraBR(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function dataBR(dia: string): string {
  if (!dia) return "";
  const [a, m, d] = dia.split("-");
  return `${d}/${m}/${a}`;
}

/** Atalhos de período, calculados no dia de hoje em Brasília. */
export type AtalhoPeriodo = "este_mes" | "mes_passado" | "7_dias" | "30_dias" | "hoje" | "tudo" | "escolher";

export function periodoDoAtalho(atalho: AtalhoPeriodo, agora: Date = new Date()): { inicio: string; fim: string } {
  const hoje = diaEmBrasilia(agora);
  const [a, m] = hoje.split("-").map(Number);
  const menosDias = (n: number) => diaEmBrasilia(new Date(agora.getTime() - n * 86_400_000));
  const pad = (n: number) => String(n).padStart(2, "0");
  switch (atalho) {
    case "hoje":
      return { inicio: hoje, fim: hoje };
    case "7_dias":
      return { inicio: menosDias(6), fim: hoje };
    case "30_dias":
      return { inicio: menosDias(29), fim: hoje };
    case "mes_passado": {
      const am = m === 1 ? a - 1 : a;
      const mm = m === 1 ? 12 : m - 1;
      const ultimo = new Date(Date.UTC(am, mm, 0)).getUTCDate();
      return { inicio: `${am}-${pad(mm)}-01`, fim: `${am}-${pad(mm)}-${pad(ultimo)}` };
    }
    case "tudo":
      return { inicio: "", fim: "" };
    case "este_mes":
    default:
      return { inicio: `${a}-${pad(m)}-01`, fim: hoje };
  }
}
