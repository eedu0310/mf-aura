/**
 * Horário de Brasília no servidor.
 *
 * O servidor pode estar em UTC (VPS recém-criada, container, build fora da
 * máquina) e aí `new Date(ano, mes, dia)` corta o dia às 21h de Brasília: o
 * "gasto de hoje" do painel e o "já rodou hoje" dos crons começavam a contar
 * três horas antes. Estas funções sempre falam do dia de São Paulo.
 *
 * O Brasil não tem horário de verão desde 2019, então o fuso é fixo -03:00.
 */
const FUSO = "America/Sao_Paulo";
const OFFSET = "-03:00";

/** "2026-11-24" — o dia de hoje (ou de `agora`) em Brasília. */
export function diaEmSaoPaulo(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

/** Meia-noite de hoje em Brasília, como instante (ISO em UTC). */
export function inicioDoDiaEmSaoPaulo(agora: Date = new Date()): string {
  return new Date(`${diaEmSaoPaulo(agora)}T00:00:00${OFFSET}`).toISOString();
}

/** Meia-noite do dia 1 deste mês em Brasília, como instante (ISO em UTC). */
export function inicioDoMesEmSaoPaulo(agora: Date = new Date()): string {
  return new Date(`${diaEmSaoPaulo(agora).slice(0, 8)}01T00:00:00${OFFSET}`).toISOString();
}
