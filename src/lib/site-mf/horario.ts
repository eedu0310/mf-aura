/**
 * Horário de atendimento do chat do site.
 * Guardado por dia da semana (0 = domingo … 6 = sábado), até dois turnos:
 *   { "1": [["08:00","11:45"],["13:30","18:00"]], "0": [] }
 */
export type Turno = [string, string];
export type Horario = Record<string, Turno[]>;

export const DIAS = [
  { dia: "1", nome: "Segunda", curto: "Seg" },
  { dia: "2", nome: "Terça", curto: "Ter" },
  { dia: "3", nome: "Quarta", curto: "Qua" },
  { dia: "4", nome: "Quinta", curto: "Qui" },
  { dia: "5", nome: "Sexta", curto: "Sex" },
  { dia: "6", nome: "Sábado", curto: "Sáb" },
  { dia: "0", nome: "Domingo", curto: "Dom" },
];

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Aceita só o formato certo; o resto é descartado. */
export function limparHorario(bruto: unknown): Horario {
  const saida: Horario = {};
  const obj = bruto && typeof bruto === "object" ? (bruto as Record<string, unknown>) : {};
  for (const { dia } of DIAS) {
    const turnos = Array.isArray(obj[dia]) ? (obj[dia] as unknown[]) : [];
    saida[dia] = turnos
      .filter((t): t is [string, string] => Array.isArray(t) && t.length === 2 && HORA.test(String(t[0])) && HORA.test(String(t[1])) && String(t[0]) < String(t[1]))
      .slice(0, 2)
      .map((t) => [String(t[0]), String(t[1])]);
  }
  return saida;
}

function turnosTexto(turnos: Turno[]) {
  return turnos.map(([a, b]) => `${a}–${b}`).join(" e ");
}

/** "Seg a Sex 08:00–11:45 e 13:30–18:00 · Sáb 09:00–12:00". Junta dias iguais seguidos. */
export function horarioEmTexto(h: Horario): string {
  const partes: string[] = [];
  let i = 0;
  while (i < DIAS.length) {
    const atual = turnosTexto(h[DIAS[i].dia] ?? []);
    let j = i;
    while (j + 1 < DIAS.length && turnosTexto(h[DIAS[j + 1].dia] ?? []) === atual) j++;
    if (atual) partes.push(`${DIAS[i].curto}${j > i ? ` a ${DIAS[j].curto}` : ""} ${atual}`);
    i = j + 1;
  }
  return partes.join(" · ");
}

/** Está dentro do horário agora, no fuso de Brasília? Sem horário cadastrado conta como sempre aberto. */
export function dentroDoHorario(h: Horario, agora = new Date()): boolean {
  const temAlgum = Object.values(h).some((t) => t.length > 0);
  if (!temAlgum) return true;
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(agora);
  const pega = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  const dia = String(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(pega("weekday")));
  const hora = `${pega("hour").replace("24", "00")}:${pega("minute")}`;
  return (h[dia] ?? []).some(([a, b]) => hora >= a && hora < b);
}
