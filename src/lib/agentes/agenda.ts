/**
 * Quando cada agente roda.
 *
 * O cron da VPS bate em /api/cron/agentes a cada 10 minutos e pergunta: quem
 * está devido agora? A resposta sai daqui, de funções puras (sem banco), para
 * poder ser testada em agenda.teste.ts — errar aqui é agente rodando duas
 * vezes (achado e aviso em dobro) ou nunca rodando (ninguém percebe).
 *
 * Tudo no fuso de São Paulo, fixo em -03:00 (o Brasil não tem mais horário de
 * verão). Hora "quebrada" vale minutos: 7 + 20/60 é 7h20. Assim um agente pode
 * rodar às 7h20 e às 18h sem mudar o formato da Agenda do contrato.
 */
import type { Agenda } from "./tipos";

const MINUTO = 60_000;
const DIA = 86_400_000;

/**
 * Até quanto tempo depois do horário marcado ainda vale rodar. Se a VPS ficou
 * fora do ar de manhã, o plano das 7h20 ainda sai às 9h — mas não às 15h, quando
 * já não serve para nada (e o das 18h está chegando).
 */
export const ATRASO_MAXIMO_MS = 3 * 60 * MINUTO;

/**
 * Folga do intervalo: o cron chama de 10 em 10 minutos, mas nunca exatamente
 * no mesmo segundo. Sem folga, um agente "a cada 10 minutos" que rodou às
 * 10h00min05s não estaria devido às 10h10min02s e pularia uma volta inteira.
 */
export const FOLGA_INTERVALO_MS = 90_000;

function diaSP(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** 0 = domingo … 6 = sábado, do dia "AAAA-MM-DD". */
function diaDaSemana(dia: string): number {
  return new Date(`${dia}T12:00:00-03:00`).getUTCDay();
}

/** Minutos desde a meia-noite de cada horário da agenda, em ordem. */
export function minutosDoDia(agenda: Extract<Agenda, { tipo: "diario" }>): number[] {
  const extra = agenda.minuto ?? 0;
  return [
    ...new Set(
      agenda.horas.map((h) => Math.floor(h) * 60 + Math.round((h - Math.floor(h)) * 60) + extra),
    ),
  ]
    .filter((m) => m >= 0 && m < 24 * 60)
    .sort((a, b) => a - b);
}

function rodaNoDia(agenda: Extract<Agenda, { tipo: "diario" }>, dia: string): boolean {
  const dias = agenda.diasSemana ?? [];
  return dias.length === 0 || dias.includes(diaDaSemana(dia));
}

function instante(dia: string, minutos: number): Date {
  const hh = String(Math.floor(minutos / 60)).padStart(2, "0");
  const mm = String(minutos % 60).padStart(2, "0");
  return new Date(`${dia}T${hh}:${mm}:00-03:00`);
}

/** O último horário marcado que já passou (até 8 dias para trás), ou null. */
export function ultimoHorario(agenda: Agenda, agora: Date): Date | null {
  if (agenda.tipo !== "diario") return null;
  const minutos = minutosDoDia(agenda);
  if (!minutos.length) return null;
  for (let k = 0; k <= 8; k++) {
    const dia = diaSP(new Date(agora.getTime() - k * DIA));
    if (!rodaNoDia(agenda, dia)) continue;
    for (let i = minutos.length - 1; i >= 0; i--) {
      const t = instante(dia, minutos[i]);
      if (t.getTime() <= agora.getTime()) return t;
    }
  }
  return null;
}

/** O próximo horário marcado depois de `agora` (até 8 dias para frente), ou null. */
export function proximoHorario(agenda: Agenda, agora: Date): Date | null {
  if (agenda.tipo !== "diario") return null;
  const minutos = minutosDoDia(agenda);
  if (!minutos.length) return null;
  for (let k = 0; k <= 8; k++) {
    const dia = diaSP(new Date(agora.getTime() + k * DIA));
    if (!rodaNoDia(agenda, dia)) continue;
    for (const m of minutos) {
      const t = instante(dia, m);
      if (t.getTime() > agora.getTime()) return t;
    }
  }
  return null;
}

/**
 * O agente está devido agora?
 *
 *  - intervalo: passou o intervalo (com folga) desde o início da última rodada;
 *  - diário: há um horário marcado que já passou, há no máximo 3 horas, e a
 *    última rodada começou antes dele.
 */
export function estaDevido(agenda: Agenda, ultimoInicio: Date | null, agora: Date): boolean {
  if (agenda.tipo === "intervalo") {
    const minutos = Math.max(1, agenda.minutos);
    if (!ultimoInicio) return true;
    return agora.getTime() - ultimoInicio.getTime() >= minutos * MINUTO - FOLGA_INTERVALO_MS;
  }
  // Agente diário que nunca rodou roda já, na primeira passada do cron: o
  // Caçador de Brechas (6h) foi ligado às 15h20 de 25/11 e ficaria parado até
  // a manhã seguinte, sem nenhum relatório. Depois da primeira, segue o horário.
  if (!ultimoInicio) return true;
  const marcado = ultimoHorario(agenda, agora);
  if (!marcado) return false;
  if (agora.getTime() - marcado.getTime() > ATRASO_MAXIMO_MS) return false;
  return !ultimoInicio || ultimoInicio.getTime() < marcado.getTime();
}

/**
 * Deveria ter rodado e não rodou? É o amarelo do escritório.
 *  - intervalo: passou mais de duas voltas (e mais 20 min de folga) sem rodar;
 *  - diário: o último horário marcado passou há mais de 30 min e a última
 *    rodada é de antes dele.
 * Quem nunca rodou não entra aqui (é "ainda não rodou").
 */
export function estaAtrasado(agenda: Agenda, ultimoInicio: Date | null, agora: Date): boolean {
  if (!ultimoInicio) return false;
  if (agenda.tipo === "intervalo") {
    const minutos = Math.max(1, agenda.minutos);
    return agora.getTime() - ultimoInicio.getTime() > (minutos * 2 + 20) * MINUTO;
  }
  const marcado = ultimoHorario(agenda, agora);
  if (!marcado || ultimoInicio.getTime() >= marcado.getTime()) return false;
  return agora.getTime() - marcado.getTime() > 30 * MINUTO;
}

/** Quando roda de novo (para a mesa do escritório). */
export function proximaExecucao(agenda: Agenda, ultimoInicio: Date | null, agora: Date): Date | null {
  if (agenda.tipo === "intervalo") {
    if (!ultimoInicio) return agora;
    const t = ultimoInicio.getTime() + Math.max(1, agenda.minutos) * MINUTO;
    return new Date(Math.max(t, agora.getTime()));
  }
  return proximoHorario(agenda, agora);
}

/**
 * O card que o agente acabou de confirmar (o problema continua) venceria
 * antes de ele rodar de novo? Então a validade tem de ser renovada agora —
 * senão o card some entre uma rodada e outra, com o problema ainda aberto.
 *
 * `proxima` é a próxima rodada marcada (proximaExecucao). Sem agenda
 * conhecida, renova o que já venceu ou vence na próxima hora.
 */
export function venceAntesDaProximaRodada(venceEmMs: number, proxima: Date | null, agora: Date): boolean {
  if (!Number.isFinite(venceEmMs) || venceEmMs <= agora.getTime()) return true;
  if (!proxima) return venceEmMs - agora.getTime() <= 60 * MINUTO;
  return venceEmMs <= proxima.getTime();
}

/**
 * Dos agentes ligados, quais rodam agora. `ultimas` é o início da última
 * rodada de cada um (id → ISO), vindo de aura_agente_execucoes.
 *
 * A ordem devolvida é a de execução: a Diretora (setor "direcao") por último,
 * para o plano dela já enxergar o que os outros acabaram de relatar.
 */
export function escolherDevidos<T extends { id: string; agenda: Agenda; ativo: boolean; setor?: string }>(
  agentes: T[],
  ultimas: Map<string, string | null>,
  agora: Date,
): T[] {
  const devidos = agentes.filter((a) => {
    if (!a.ativo) return false;
    const iso = ultimas.get(a.id) ?? null;
    const ultimo = iso ? new Date(iso) : null;
    return estaDevido(a.agenda, ultimo && Number.isFinite(ultimo.getTime()) ? ultimo : null, agora);
  });
  return [
    ...devidos.filter((a) => a.setor !== "direcao"),
    ...devidos.filter((a) => a.setor === "direcao"),
  ];
}

function horaTexto(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

function listaTexto(itens: string[]): string {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

const NOMES_DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** "A cada 10 minutos", "Todo dia às 7h40", "De segunda a sábado às 7h20 e 18h". */
export function agendaTexto(agenda: Agenda): string {
  if (agenda.tipo === "intervalo") {
    const m = Math.max(1, agenda.minutos);
    if (m % 1440 === 0) return m === 1440 ? "Uma vez por dia" : `A cada ${m / 1440} dias`;
    if (m % 60 === 0) return m === 60 ? "A cada hora" : `A cada ${m / 60} horas`;
    return m === 1 ? "A cada minuto" : `A cada ${m} minutos`;
  }
  const horas = minutosDoDia(agenda).map(horaTexto);
  const quando = horas.length ? ` às ${listaTexto(horas)}` : "";
  const dias = [...new Set(agenda.diasSemana ?? [])].filter((d) => d >= 0 && d <= 6).sort();
  if (dias.length === 0 || dias.length === 7) return `Todo dia${quando}`;
  if (dias.join(",") === "1,2,3,4,5,6") return `De segunda a sábado${quando}`;
  if (dias.join(",") === "1,2,3,4,5") return `De segunda a sexta${quando}`;
  if (dias.length === 1) {
    const nome = NOMES_DIAS[dias[0]];
    const fimDeSemana = nome === "sábado" || nome === "domingo";
    return `${fimDeSemana ? `Aos ${nome}s` : `Às ${nome}s-feiras`}${quando}`;
  }
  return `${listaTexto(dias.map((d) => NOMES_DIAS[d]))}${quando}`.replace(/^./, (c) => c.toUpperCase());
}

/** Confere (sem confiar) uma agenda vinda do banco ou de uma proposta. */
export function agendaValida(v: unknown): Agenda | null {
  if (!v || typeof v !== "object") return null;
  const a = v as Record<string, unknown>;
  if (a.tipo === "intervalo" && typeof a.minutos === "number" && a.minutos >= 1) {
    return { tipo: "intervalo", minutos: a.minutos };
  }
  if (a.tipo === "diario" && Array.isArray(a.horas)) {
    const horas = a.horas.filter((h): h is number => typeof h === "number" && h >= 0 && h < 24);
    if (!horas.length) return null;
    const dias = Array.isArray(a.diasSemana)
      ? a.diasSemana.filter((d): d is number => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6)
      : undefined;
    return {
      tipo: "diario",
      horas,
      ...(typeof a.minuto === "number" ? { minuto: a.minuto } : {}),
      ...(dias ? { diasSemana: dias } : {}),
    };
  }
  return null;
}
