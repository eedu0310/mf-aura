/**
 * Quem roda agora. Errar aqui é agente rodando duas vezes (achado e aviso em
 * dobro) ou nunca rodando (e ninguém percebe) — por isso a escolha é pura e
 * tem teste.
 *
 * Rodar com:
 *   node --experimental-strip-types --no-warnings --import <reg.mjs> src/lib/agentes/agenda.teste.ts
 */
import { agendaTexto, agendaValida, escolherDevidos, estaDevido, proximaExecucao, venceAntesDaProximaRodada } from "./agenda";
import type { Agenda } from "./tipos";

let passou = 0;
const falhas: string[] = [];
function conferir(oque: string, real: unknown, esperado: unknown) {
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a === b) passou += 1;
  else falhas.push(`${oque}\n  esperado: ${b}\n  veio:     ${a}`);
}

/** Instante em São Paulo. */
const sp = (dia: string, hhmm: string) => new Date(`${dia}T${hhmm}:00-03:00`);

// 2026-11-25 é uma quarta; 2026-11-29 é domingo.
const diretora: Agenda = { tipo: "diario", horas: [7 + 20 / 60, 18], diasSemana: [1, 2, 3, 4, 5, 6] };
const guardiao: Agenda = { tipo: "diario", horas: [23], minuto: 30 };
const dezMin: Agenda = { tipo: "intervalo", minutos: 10 };

// ---- diário
conferir("antes do primeiro horário não está devido", estaDevido(diretora, null, sp("2026-11-25", "07:10")), false);
conferir("7h20: devido (nunca rodou)", estaDevido(diretora, null, sp("2026-11-25", "07:20")), true);
conferir("7h30 depois de rodar às 7h20: não", estaDevido(diretora, sp("2026-11-25", "07:20"), sp("2026-11-25", "07:30")), false);
conferir("rodou ontem às 18h: hoje 7h25 está devido", estaDevido(diretora, sp("2026-11-24", "18:00"), sp("2026-11-25", "07:25")), true);
conferir("18h05 depois da manhã: devido", estaDevido(diretora, sp("2026-11-25", "07:20"), sp("2026-11-25", "18:05")), true);
conferir("atrasou mais de 3 h: não recupera", estaDevido(diretora, sp("2026-11-24", "18:00"), sp("2026-11-25", "11:00")), false);
conferir("atrasou 2 h: ainda recupera", estaDevido(diretora, sp("2026-11-24", "18:00"), sp("2026-11-25", "09:20")), true);
conferir("domingo a Diretora não roda", estaDevido(diretora, sp("2026-11-28", "18:00"), sp("2026-11-29", "07:30")), false);
conferir("segunda às 7h20 volta", estaDevido(diretora, sp("2026-11-28", "18:00"), sp("2026-11-30", "07:21")), true);
conferir("Guardião 23h30", estaDevido(guardiao, sp("2026-11-24", "23:30"), sp("2026-11-25", "23:30")), true);
conferir("Guardião 23h40 já rodou às 23h30", estaDevido(guardiao, sp("2026-11-25", "23:30"), sp("2026-11-25", "23:40")), false);
conferir("Guardião depois da meia-noite ainda recupera o de ontem", estaDevido(guardiao, sp("2026-11-24", "23:30"), sp("2026-11-26", "00:20")), true);

// ---- intervalo
conferir("intervalo: nunca rodou", estaDevido(dezMin, null, sp("2026-11-25", "10:00")), true);
conferir("intervalo: rodou há 5 min", estaDevido(dezMin, sp("2026-11-25", "10:00"), sp("2026-11-25", "10:05")), false);
conferir(
  "intervalo: cron atrasou uns segundos (folga)",
  estaDevido(dezMin, new Date(sp("2026-11-25", "10:00").getTime() + 20_000), sp("2026-11-25", "10:10")),
  true,
);

// ---- escolherDevidos (o coração de agentesDevidos)
{
  const agentes = [
    { id: "diretora", setor: "direcao", ativo: true, agenda: diretora },
    { id: "followup", setor: "vendas", ativo: true, agenda: dezMin },
    { id: "desligado", setor: "vendas", ativo: false, agenda: dezMin },
    { id: "guardiao", setor: "conhecimento", ativo: true, agenda: guardiao },
  ];
  const ultimas = new Map<string, string | null>([
    ["diretora", sp("2026-11-24", "18:00").toISOString()],
    ["followup", sp("2026-11-25", "07:00").toISOString()],
    ["guardiao", sp("2026-11-24", "23:30").toISOString()],
  ]);
  const ids = escolherDevidos(agentes, ultimas, sp("2026-11-25", "07:20")).map((a) => a.id);
  conferir("devidos às 7h20, Diretora por último, desligado fora", ids, ["followup", "diretora"]);
  conferir(
    "data inválida no diário conta como 'nunca rodou'",
    escolherDevidos([agentes[1]], new Map([["followup", "lixo"]]), sp("2026-11-25", "07:20")).map((a) => a.id),
    ["followup"],
  );
}

// ---- próxima execução
conferir("próxima da Diretora às 7h30 é 18h", proximaExecucao(diretora, null, sp("2026-11-25", "07:30"))?.toISOString(), sp("2026-11-25", "18:00").toISOString());
conferir("sábado 18h30 → segunda 7h20", proximaExecucao(diretora, null, sp("2026-11-28", "18:30"))?.toISOString(), sp("2026-11-30", "07:20").toISOString());
conferir(
  "intervalo: última + 10 min",
  proximaExecucao(dezMin, sp("2026-11-25", "10:00"), sp("2026-11-25", "10:03"))?.toISOString(),
  sp("2026-11-25", "10:10").toISOString(),
);


// ---- validade dos cards: renova se venceria antes da próxima rodada
{
  const metas: Agenda = { tipo: "diario", horas: [9], diasSemana: [1, 2, 3, 4, 5, 6] };
  // Card criado ontem 9h00min05s com 1 dia de validade; hoje a rodada é 9h00min03s.
  const agora = new Date(sp("2026-11-25", "09:00").getTime() + 3_000);
  const vence = sp("2026-11-25", "09:00").getTime() + 5_000;
  conferir(
    "metas 1 dia: renova hoje (amanhã já teria sumido)",
    venceAntesDaProximaRodada(vence, proximaExecucao(metas, agora, agora), agora),
    true,
  );
  const followup: Agenda = { tipo: "diario", horas: [7], minuto: 40, diasSemana: [1, 2, 3, 4, 5, 6] };
  const agoraF = sp("2026-11-25", "07:41");
  const venceF = sp("2026-11-26", "07:40").getTime() + 10_000;
  conferir(
    "follow-up 2 dias, 1º dia depois: ainda não renova",
    venceAntesDaProximaRodada(venceF, proximaExecucao(followup, agoraF, agoraF), agoraF),
    false,
  );
  const sabado = sp("2026-11-28", "07:41");
  conferir(
    "sábado: vence domingo, próxima rodada só segunda → renova",
    venceAntesDaProximaRodada(sp("2026-11-29", "07:40").getTime(), proximaExecucao(followup, sabado, sabado), sabado),
    true,
  );
  const agoraL = sp("2026-11-25", "10:00");
  conferir(
    "intervalo 10 min: vence em 5 min → renova",
    venceAntesDaProximaRodada(agoraL.getTime() + 5 * 60_000, proximaExecucao(dezMin, agoraL, agoraL), agoraL),
    true,
  );
  conferir(
    "intervalo 10 min: vence em 1 dia → não",
    venceAntesDaProximaRodada(agoraL.getTime() + 86_400_000, proximaExecucao(dezMin, agoraL, agoraL), agoraL),
    false,
  );
  conferir("já vencido (ainda pendente) → renova", venceAntesDaProximaRodada(agoraL.getTime() - 1, null, agoraL), true);
}

// ---- texto
conferir("texto Diretora", agendaTexto(diretora), "De segunda a sábado às 7h20 e 18h");
conferir("texto Guardião", agendaTexto(guardiao), "Todo dia às 23h30");
conferir("texto intervalo", agendaTexto(dezMin), "A cada 10 minutos");
conferir("texto domingo", agendaTexto({ tipo: "diario", horas: [21], diasSemana: [0] }), "Aos domingos às 21h");
conferir("texto segunda", agendaTexto({ tipo: "diario", horas: [10], diasSemana: [1] }), "Às segundas-feiras às 10h");

// ---- agenda vinda do banco
conferir("agenda válida", agendaValida({ tipo: "intervalo", minutos: 60 }), { tipo: "intervalo", minutos: 60 });
conferir("agenda sem horas", agendaValida({ tipo: "diario", horas: [] }), null);
conferir("agenda lixo", agendaValida("todo dia"), null);

if (falhas.length) {
  console.error(`${falhas.length} verificação(ões) falharam:\n\n${falhas.join("\n\n")}`);
  process.exit(1);
}
console.log(`${passou}/${passou} verificações passaram`);
