/**
 * Testes da regra do Agente de Manutenção (sem banco).
 */
import { prioridadeManutencao, situacaoManutencao, type ManutencaoParaRegra } from "./manutencao-regras";

let falhas = 0;
function ok(desc: string, real: unknown, esperado: unknown) {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? "ok  " : "FALHA"} ${desc} -> ${JSON.stringify(real)}${bom ? "" : ` (esperado ${JSON.stringify(esperado)})`}`);
}

const HOJE = "2026-11-25";
const m = (p: Partial<ManutencaoParaRegra>): ManutencaoParaRegra => ({ status: "prevista", dataPrevista: "2027-06-01", dataAgendada: null, ...p });

console.log("--- previsão (instalação + 12 meses) ---");
ok("daqui a 6 meses: nada ainda", situacaoManutencao(m({}), HOJE), null);
ok("daqui a 30 dias (11º mês): avisa", situacaoManutencao(m({ dataPrevista: "2026-12-25" }), HOJE), "proxima");
ok("daqui a 31 dias: ainda não", situacaoManutencao(m({ dataPrevista: "2026-12-26" }), HOJE), null);
ok("hoje conta como próxima", situacaoManutencao(m({ dataPrevista: HOJE }), HOJE), "proxima");
ok("ontem: vencida", situacaoManutencao(m({ dataPrevista: "2026-11-24" }), HOJE), "vencida");

console.log("\n--- registros ---");
ok("agendada para semana que vem: nada a cobrar", situacaoManutencao(m({ status: "agendada", dataPrevista: "2026-11-20", dataAgendada: "2026-12-02" }), HOJE), null);
ok("agendada e a data passou: vencida (marcar feita ou reagendar)", situacaoManutencao(m({ status: "agendada", dataAgendada: "2026-11-20" }), HOJE), "vencida");
ok("data agendada vale mais que a prevista", situacaoManutencao(m({ dataPrevista: "2026-10-01", dataAgendada: "2026-12-10", status: "agendada" }), HOJE), null);
ok("realizada some", situacaoManutencao(m({ status: "realizada", dataPrevista: "2026-01-01" }), HOJE), null);
ok("cancelada some", situacaoManutencao(m({ status: "cancelada", dataPrevista: "2026-01-01" }), HOJE), null);

console.log("\n--- estação ---");
ok("vencida em novembro: média", prioridadeManutencao("vencida", HOJE), "media");
ok("vencida em abril (antes do frio): alta", prioridadeManutencao("vencida", "2027-04-10"), "alta");
ok("chegando em março: média", prioridadeManutencao("proxima", "2027-03-01"), "media");
ok("chegando em outubro: baixa", prioridadeManutencao("proxima", "2026-10-01"), "baixa");

console.log(falhas === 0 ? "\nTUDO PASSOU" : `\n${falhas} FALHA(S)`);
process.exit(falhas ? 1 : 0);
