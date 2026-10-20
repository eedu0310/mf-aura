/** Rodar com: npx tsx src/lib/whatsapp/nao-lead.teste.ts */
import { pareceNaoLeadRecente, falaDeProduto } from "./nao-lead";

let passou = 0;
function conferir(nome: string, obtido: unknown, esperado: unknown) {
  if (JSON.stringify(obtido) !== JSON.stringify(esperado)) {
    console.error(`FALHOU: ${nome}\n  esperado ${JSON.stringify(esperado)}\n  obtido   ${JSON.stringify(obtido)}`);
    process.exit(1);
  }
  passou += 1;
}

const agora = new Date("2026-10-20T12:00:00Z");
const ontem = "2026-10-19T12:00:00Z";
const haDezDias = "2026-10-10T12:00:00Z";
const naoLead = { lead_sugerido: false, confianca_lead: 0.15, natureza: null, ultima_analise_em: ontem };

conferir("instalador analisado ontem: pula", pareceNaoLeadRecente(naoLead, { text: "tô na obra" }, agora), true);
conferir("mensagem do próprio vendedor: pula igual", pareceNaoLeadRecente(naoLead, { fromMe: true, text: "lareira" }, agora), true);
conferir("passou uma semana: analisa", pareceNaoLeadRecente({ ...naoLead, ultima_analise_em: haDezDias }, { text: "oi" }, agora), false);
conferir("cliente fala de preço: analisa", pareceNaoLeadRecente(naoLead, { text: "quanto custa a de pedra?" }, agora), false);
conferir("cliente fala de piscina: analisa", pareceNaoLeadRecente(naoLead, { text: "aquecedor de piscina tem?" }, agora), false);
conferir("IA sugeriu lead: analisa", pareceNaoLeadRecente({ ...naoLead, lead_sugerido: true, confianca_lead: 0.8 }, { text: "oi" }, agora), false);
conferir("confiança no meio (0,5): analisa", pareceNaoLeadRecente({ ...naoLead, confianca_lead: 0.5 }, { text: "oi" }, agora), false);
conferir("vendedor já decidiu: não é daqui", pareceNaoLeadRecente({ ...naoLead, natureza: "nao_lead" }, { text: "oi" }, agora), false);
conferir("nunca analisado: analisa", pareceNaoLeadRecente({ ...naoLead, ultima_analise_em: null }, { text: "oi" }, agora), false);
conferir("sem confiança gravada: analisa", pareceNaoLeadRecente({ ...naoLead, confianca_lead: null }, { text: "oi" }, agora), false);

conferir("produto: boiler", falaDeProduto("meu boiler parou"), true);
conferir("produto: acento", falaDeProduto("ORÇAMENTO por favor"), true);
conferir("não produto", falaDeProduto("bom dia, tudo bem?"), false);
conferir("vazio", falaDeProduto(null), false);

console.log(`${passou}/${passou} verificações passaram`);
