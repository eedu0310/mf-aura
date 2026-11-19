import assert from "node:assert/strict";
import { atividadeDoVendedor, contextoDaCobranca, itensDaCobranca, relacionamentoDoVendedor, type NumerosDoMes } from "./cobranca";

let ok = 0;
const caso = (nome: string, f: () => void) => { f(); ok++; console.log("ok -", nome); };
const zero: NumerosDoMes = { oportunidadesCriadas: 0, fechamentos: 0, atividades: 0, relacionamentos: 0, conversasWhatsapp: 0 };
const chaves = (n: NumerosDoMes, d: number) => itensDaCobranca(n, d).map((i) => i.chave);

caso("dias 1 e 2 não cobram nada", () => { assert.deepEqual(chaves(zero, 1), []); assert.deepEqual(chaves(zero, 2), []); });
caso("dia 3 cobra tudo menos fechamento", () => assert.deepEqual(chaves(zero, 3), ["sem_oportunidade", "sem_atividade", "sem_relacionamento"]));
caso("dia 10 cobra fechamento também", () => assert.deepEqual(chaves(zero, 10), ["sem_oportunidade", "sem_fechamento", "sem_atividade", "sem_relacionamento"]));
caso("quem tem tudo não é cobrado", () => assert.deepEqual(chaves({ oportunidadesCriadas: 1, fechamentos: 1, atividades: 1, relacionamentos: 1, conversasWhatsapp: 9 }, 20), []));
caso("só o que falta", () => assert.deepEqual(chaves({ ...zero, oportunidadesCriadas: 2, atividades: 5 }, 15), ["sem_fechamento", "sem_relacionamento"]));
caso("cada item tem pergunta", () => itensDaCobranca(zero, 12).forEach((i) => assert.match(i.pergunta, /^Por que/)));
caso("contexto do WhatsApp", () => {
  assert.equal(contextoDaCobranca(zero), null);
  assert.match(contextoDaCobranca({ ...zero, conversasWhatsapp: 1 })!, /1 cliente no WhatsApp/);
  assert.match(contextoDaCobranca({ ...zero, conversasWhatsapp: 17 })!, /17 clientes/);
});
caso("relacionamento automático não conta", () => {
  assert.equal(relacionamentoDoVendedor("WhatsApp"), false);
  assert.equal(relacionamentoDoVendedor("Site MF International"), false);
  assert.equal(relacionamentoDoVendedor("Indicação"), true);
  assert.equal(relacionamentoDoVendedor(null), true);
});
caso("atividade automática não conta", () => {
  assert.equal(atividadeDoVendedor("whatsapp_ia"), false);
  assert.equal(atividadeDoVendedor("whatsapp_auto"), false);
  assert.equal(atividadeDoVendedor("manual"), true);
  assert.equal(atividadeDoVendedor(null), true);
});
console.log(`${ok} casos ok`);
