/** Rodar com: npx tsx src/lib/gestor/ficha-relacionamento.teste.ts */
import { sinaisDoRelacionamento, type EntradaDosSinais } from "./ficha-relacionamento";

let passou = 0;
function conferir(nome: string, obtido: unknown, esperado: unknown) {
  if (JSON.stringify(obtido) !== JSON.stringify(esperado)) {
    console.error(`FALHOU: ${nome}\n  esperado ${JSON.stringify(esperado)}\n  obtido   ${JSON.stringify(obtido)}`);
    process.exit(1);
  }
  passou += 1;
}

const agora = new Date("2026-10-21T15:00:00Z");
const base: EntradaDosSinais = {
  agora, ultimoContatoEm: "2026-10-20T15:00:00Z", proximoContatoEm: null,
  negociosAbertos: [], leadSemResposta: null, clienteEsperandoDesde: null, temperatura: "ativo",
};
const textos = (e: Partial<EntradaDosSinais>) => sinaisDoRelacionamento({ ...base, ...e }).map((s) => `${s.gravidade}:${s.texto}`);

conferir("tudo em dia: nenhum sinal", textos({}), []);
conferir("8 dias sem contato com negócio: alta",
  textos({ ultimoContatoEm: "2026-10-13T15:00:00Z", negociosAbertos: [{ etapa: "Follow-up", valor: 5000, atualizadoEm: "2026-10-20T15:00:00Z", exigeValor: false }] }),
  ["alta:Sem contato há 8 dias com negócio em aberto"]);
conferir("8 dias sem negócio: nada (limite é 15)", textos({ ultimoContatoEm: "2026-10-13T15:00:00Z" }), []);
conferir("5 dias com negócio: esfriando",
  textos({ ultimoContatoEm: "2026-10-16T15:00:00Z", negociosAbertos: [{ etapa: "Apresentação", valor: 0, atualizadoEm: null, exigeValor: false }] }),
  ["media:Sem contato há 5 dias — esfriando"]);
conferir("negociação sem valor",
  textos({ negociosAbertos: [{ etapa: "Negociação", valor: 0, atualizadoEm: "2026-10-20T15:00:00Z", exigeValor: true }] }),
  ["media:Negócio em Negociação sem valor"]);
conferir("negócio parado 30+ dias: alta",
  textos({ negociosAbertos: [{ etapa: "Follow-up", valor: 1, atualizadoEm: "2026-09-15T15:00:00Z", exigeValor: false }] }),
  ["alta:Negócio parado em Follow-up há 36 dias"]);
conferir("cliente esperando 1h: nada", textos({ clienteEsperandoDesde: "2026-10-21T14:00:00Z" }), []);
conferir("cliente esperando 3h: média", textos({ clienteEsperandoDesde: "2026-10-21T12:00:00Z" }), ["media:Cliente esperando resposta no WhatsApp há 3 h"]);
conferir("cliente esperando 2 dias: alta", textos({ clienteEsperandoDesde: "2026-10-19T15:00:00Z" }), ["alta:Cliente esperando resposta no WhatsApp há 2 dia(s)"]);
conferir("lead sem resposta 5h: alta", textos({ leadSemResposta: { chegouEm: "2026-10-21T10:00:00Z" } }), ["alta:Lead chegou há 5 h e não tem resposta registrada"]);
conferir("próximo contato vencido 4 dias: alta", textos({ proximoContatoEm: "2026-10-17T15:00:00Z" }), ["alta:Próximo contato combinado venceu há 4 dia(s)"]);
conferir("nunca contatado com negócio: alta",
  textos({ ultimoContatoEm: null, negociosAbertos: [{ etapa: "Prospecção", valor: 0, atualizadoEm: null, exigeValor: false }] }),
  ["alta:Nenhum contato registrado"]);
conferir("ordem: alta antes de média",
  textos({ proximoContatoEm: "2026-10-20T00:00:00Z", leadSemResposta: { chegouEm: "2026-10-21T08:00:00Z" } }).map((t) => t.split(":")[0]),
  ["alta", "media"]);

console.log(`${passou}/${passou} verificações passaram`);
