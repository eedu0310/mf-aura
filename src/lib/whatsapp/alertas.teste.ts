/**
 * Quem sai dos alertas de lead do WhatsApp (Elton, 27/11/2026: "mesmo
 * colocando lead frio não sai dos leads em alerta").
 */
import { ficaForaDosAlertas } from "./stage-rules";
import { FUNIL_PADRAO, type EtapaFunil } from "@/lib/funil";

let passou = 0;
const falhas: string[] = [];
function conferir(oque: string, real: unknown, esperado: unknown) {
  if (JSON.stringify(real) === JSON.stringify(esperado)) passou += 1;
  else falhas.push(`${oque}\n  esperado: ${JSON.stringify(esperado)}\n  veio:     ${JSON.stringify(real)}`);
}

const FRIOS: EtapaFunil = { nome: "Leads frios", ordem: 0, tipo: "aberta", contaNoPipeline: false, probabilidade: "Baixa", cor: "#94a3b8", ativa: true, chave: "lead_frio" };
const funil = [FRIOS, ...FUNIL_PADRAO];

conferir("card em Leads frios sai", ficaForaDosAlertas({ natureza: "lead", etapaCard: "Leads frios" }, funil), true);
conferir("card em Perdidos sai", ficaForaDosAlertas({ natureza: "lead", etapaCard: "Perdidos" }, funil), true);
conferir("card em Pós-venda sai", ficaForaDosAlertas({ natureza: "lead", etapaCard: "Pós-venda" }, funil), true);
conferir("card em Fechamento sai", ficaForaDosAlertas({ natureza: "lead", etapaCard: "Fechamento" }, funil), true);
conferir("cliente antigo sai", ficaForaDosAlertas({ natureza: "cliente", etapaCard: "Negociação" }, funil), true);
conferir("não é lead sai", ficaForaDosAlertas({ natureza: "nao_lead", etapaCard: null }, funil), true);

for (const etapa of ["Prospecção", "Qualificação e Abordagem", "Apresentação", "Follow-up", "Negociação"]) {
  conferir(`card em ${etapa} continua com alerta`, ficaForaDosAlertas({ natureza: "lead", etapaCard: etapa }, funil), false);
}
conferir("lead sem card continua com alerta", ficaForaDosAlertas({ natureza: "lead", etapaCard: null }, funil), false);
conferir("sem natureza e sem card continua", ficaForaDosAlertas({}, funil), false);
conferir("etapa que não existe mais no funil não some com o alerta", ficaForaDosAlertas({ natureza: "lead", etapaCard: "Etapa apagada" }, funil), false);

// A loja que renomeou a coluna: vale a chave, não o nome.
const renomeado = funil.map((e) => (e.chave === "lead_frio" ? { ...e, nome: "Curiosos" } : e));
conferir("coluna de frios renomeada continua saindo", ficaForaDosAlertas({ natureza: "lead", etapaCard: "Curiosos" }, renomeado), true);

if (falhas.length) {
  console.error(`${falhas.length} verificação(ões) falharam:\n\n${falhas.join("\n\n")}`);
  process.exit(1);
}
console.log(`${passou}/${passou} verificações passaram`);
