/**
 * Testes da regra do Guardião dos Leads (sem banco).
 */
import { donoDoLead, situacaoDoLead, type LeadSla } from "./leads";

let falhas = 0;
function ok(desc: string, real: unknown, esperado: unknown) {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? "ok  " : "FALHA"} ${desc} -> ${JSON.stringify(real)}${bom ? "" : ` (esperado ${JSON.stringify(esperado)})`}`);
}

const CHEGOU = Date.parse("2026-11-25T14:00:00-03:00");
const MIN = 60_000;
const lead = (p: Partial<LeadSla> = {}): LeadSla => ({
  id: "l1", empresa: "Sole Aquecimento", nome: "Lead", status: "repassado_vendedor", sdr_id: null, vendedor_id: "ana",
  prazo_resposta: new Date(CHEGOU + 30 * MIN).toISOString(), respondido_em: null, created_at: new Date(CHEGOU).toISOString(), ...p,
  relacionamento_id: p.relacionamento_id ?? null,
});
const sit = (l: LeadSla, minutosDepois: number, atendidoEm: number | null = null) => situacaoDoLead(l, CHEGOU + minutosDepois * MIN, atendidoEm).situacao;

console.log("--- prazo de 30 minutos ---");
ok("com 10 min, no prazo", sit(lead(), 10), "no_prazo");
ok("com 15 min (metade), avisa", sit(lead(), 15), "metade");
ok("com 29 min, ainda metade", sit(lead(), 29), "metade");
ok("com 31 min, vencido", sit(lead(), 31), "vencido");
ok("minutos para vencer (negativo = atraso)", situacaoDoLead(lead(), CHEGOU + 45 * MIN).minutosParaVencer, -15);

console.log("\n--- atendido não é cobrado ---");
ok("marcado como respondido", sit(lead({ respondido_em: new Date(CHEGOU + 5 * MIN).toISOString() }), 60), "atendido");
ok("atividade depois da chegada conta como atendimento", sit(lead(), 60, CHEGOU + 20 * MIN), "atendido");
ok("atividade de ANTES da chegada não conta", sit(lead(), 60, CHEGOU - 60 * MIN), "vencido");

console.log("\n--- fila e prazo ausente ---");
ok("lead frio saiu da fila", sit(lead({ status: "lead_frio" }), 60), "fora_da_fila");
ok("perdido saiu da fila", sit(lead({ status: "perdido" }), 60), "fora_da_fila");
ok("sem prazo gravado usa 30 min: aos 20 é metade", sit(lead({ prazo_resposta: null }), 20), "metade");
ok("sem prazo gravado: aos 40 venceu", sit(lead({ prazo_resposta: null }), 40), "vencido");

console.log("\n--- dono ---");
ok("vendedor é o dono", donoDoLead({ vendedor_id: "ana", sdr_id: "sdr" }), "ana");
ok("sem vendedor, o SDR", donoDoLead({ vendedor_id: null, sdr_id: "sdr" }), "sdr");
ok("sem ninguém", donoDoLead({ vendedor_id: null, sdr_id: null }), null);

console.log(falhas === 0 ? "\nTUDO PASSOU" : `\n${falhas} FALHA(S)`);
process.exit(falhas ? 1 : 0);
