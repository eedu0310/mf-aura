/**
 * Teste do raio-x do dia. Roda com:
 *   npx tsx src/lib/raio-x/montar.teste.ts
 *
 * O que protege: que o vendedor não veja o mesmo cliente duas vezes, que nada
 * suma por causa do teto por bloco, e que "atrasado" seja mesmo atrasado.
 */
import { FUNIL_PADRAO } from "../funil";
import { montarRaioX, type DadosDoRaioX } from "./montar";

let falhas = 0;
let total = 0;
function igual(a: unknown, b: unknown, o_que: string) {
  total++;
  if (a !== b) {
    falhas++;
    console.error(`  FALHOU: ${o_que} (deu ${JSON.stringify(a)}, esperava ${JSON.stringify(b)})`);
  }
}
function ok(certo: boolean, o_que: string) {
  total++;
  if (!certo) {
    falhas++;
    console.error("  FALHOU:", o_que);
  }
}

// 12:00 em São Paulo, para o dia não virar no meio do teste.
const AGORA = new Date("2026-10-06T15:00:00Z");
const HOJE = "2026-10-06";
const ONTEM = "2026-10-05";

const vazio: DadosDoRaioX = {
  compromissos: [],
  relacionamentos: [],
  oportunidades: [],
  funil: FUNIL_PADRAO,
  agora: AGORA,
};

// --------------------------------------------------------------- dia calmo
const calmo = montarRaioX(vazio);
igual(calmo.blocos.length, 0, "dia sem nada não inventa bloco");
igual(calmo.totalDeItens, 0, "dia sem nada soma zero");
igual(calmo.dia, HOJE, "o dia é o de São Paulo");

// --------------------------------------------------------------- agenda
const comAgenda = montarRaioX({
  ...vazio,
  compromissos: [
    { titulo: "Visita", relacionamentoNome: "Markus Arquitetura", tipo: "Visita", data: HOJE, hora: "10:00", local: "B. Retiro", concluido: false },
    { titulo: "Ligar", relacionamentoNome: "Rita", tipo: "Ligação", data: ONTEM, concluido: false },
    { titulo: "Feito", tipo: "Outro", data: HOJE, hora: "08:00", concluido: true },
    { titulo: "Semana que vem", tipo: "Outro", data: "2026-10-20", concluido: false },
  ],
});
const agenda = comAgenda.blocos.find((b) => b.tipo === "agenda")!;
igual(agenda.total, 2, "agenda traz só o que não foi feito e não é do futuro");
igual(agenda.itens[0].titulo, "Ligação: Rita", "o atrasado de ontem vem primeiro");
ok(agenda.itens[0].urgente === true, "compromisso de ontem é urgente");
igual(agenda.itens[1].hora, "10:00", "a visita de hoje mantém a hora");
ok(/B. Retiro/.test(agenda.itens[1].detalhe ?? ""), "o local aparece no detalhe");

// ------------------------------------------------------------ follow-ups
const comFollow = montarRaioX({
  ...vazio,
  relacionamentos: [
    { id: "a", nome: "Nicolas de Paris", temperatura: "ativo", proximoContatoEm: `${ONTEM}T12:00:00Z` },
    { id: "b", nome: "Jardel Rosa", temperatura: "ativo", proximoContatoEm: `${HOJE}T12:00:00Z` },
    { id: "c", nome: "Futuro", temperatura: "ativo", proximoContatoEm: "2026-11-01T12:00:00Z" },
    { id: "d", nome: "Sem data", temperatura: "ativo",  },
  ],
});
const follow = comFollow.blocos.find((b) => b.tipo === "followup")!;
igual(follow.total, 2, "follow-up conta hoje e atrasado, não o futuro nem o sem data");
igual(follow.itens[0].titulo, "Nicolas de Paris", "o atrasado vem antes");
ok(follow.itens[0].urgente === true, "atrasado é urgente");
ok(follow.itens[1].detalhe === "marcado para hoje", "o de hoje não é chamado de atrasado");

// -------------------------------------- o mesmo cliente não aparece 2x
const semRepetir = montarRaioX({
  ...vazio,
  relacionamentos: [
    { id: "a", nome: "Alcindo", temperatura: "frio", proximoContatoEm: `${ONTEM}T12:00:00Z` },
    { id: "b", nome: "Outro Frio", temperatura: "frio",  },
  ],
});
const esfriando = semRepetir.blocos.find((b) => b.tipo === "esfriando")!;
igual(esfriando.total, 1, "quem já está em follow-up não repete em esfriando");
igual(esfriando.itens[0].titulo, "Outro Frio", "sobra só quem não tinha data marcada");

// ------------------------------------------------- pipeline: parado x quente
const comPipeline = montarRaioX({
  ...vazio,
  oportunidades: [
    { cliente: "Marinho Camargo", valor: 15000, etapa: "Follow-up", diasParado: 2 },
    { cliente: "Paulo Andrade", valor: 9000, etapa: "Negociação", diasParado: 20 },
    { cliente: "Já fechado", valor: 50000, etapa: "Fechamento", diasParado: 90 },
    { cliente: "Perdido", valor: 1000, etapa: "Perdidos", diasParado: 30 },
    { cliente: "Lead cru", valor: 0, etapa: "Prospecção", diasParado: 1 },
  ],
});
const naMesa = comPipeline.blocos.find((b) => b.tipo === "orcamento")!;
const parado = comPipeline.blocos.find((b) => b.tipo === "parado")!;
igual(naMesa.total, 1, "orçamento na mesa: só etapa que conta no pipeline e ainda quente");
igual(naMesa.itens[0].titulo, "Marinho Camargo", "o quente é o que não está parado");
igual(parado.total, 1, "parado: 7 dias ou mais, e fora os já decididos");
igual(parado.itens[0].titulo, "Paulo Andrade", "o parado é o de 20 dias");
ok(parado.itens[0].urgente === true, "20 dias parado é urgente");
ok(
  !comPipeline.blocos.some((b) => b.itens.some((i) => i.titulo === "Já fechado" || i.titulo === "Perdido")),
  "negócio já decidido não entra no raio-x",
);

// ------------------------------------------------------------- pós-venda
const comPos = montarRaioX({
  ...vazio,
  posVendas: [
    { cliente: "Com reclamação", status: "reclamacao", reclamacaoResolvida: false },
    { cliente: "Reclamação resolvida", status: "reclamacao", reclamacaoResolvida: true },
    { cliente: "Instalação atrasada", status: "agendamento_realizado", instalacaoAgendadaEm: `${ONTEM}T10:00:00Z`, reclamacaoResolvida: false },
    { cliente: "Instalação em novembro", status: "agendamento_realizado", instalacaoAgendadaEm: "2026-11-10T10:00:00Z", reclamacaoResolvida: false },
  ],
});
const pos = comPos.blocos.find((b) => b.tipo === "posvenda")!;
igual(pos.total, 2, "pós-venda: reclamação aberta e instalação vencida");
ok(
  !pos.itens.some((i) => i.titulo === "Reclamação resolvida"),
  "reclamação já resolvida não volta a aparecer",
);
ok(
  !pos.itens.some((i) => i.titulo === "Instalação em novembro"),
  "instalação futura não é problema de hoje",
);

// -------------------------------------------------- teto por bloco mostra o total
const muitos = montarRaioX({
  ...vazio,
  relacionamentos: Array.from({ length: 30 }, (_, i) => ({
    id: `r${i}`, vendedorId: "v", nome: `Cliente ${i}`, categoria: "Cliente Final" as const,
    temperatura: "ativo", proximoContatoEm: `${ONTEM}T12:00:00Z`,
  })),
});
const grande = muitos.blocos.find((b) => b.tipo === "followup")!;
igual(grande.itens.length, 12, "a lista na tela para em 12");
igual(grande.total, 30, "mas o total continua dizendo que são 30");
igual(muitos.totalDeItens, 30, "a soma do dia usa o total, não o que coube na tela");

// ------------------------------------------------- singular e plural
const umLead = montarRaioX({ ...vazio, leadsPendentes: [{ id: "1", nome: "Um só" }] });
igual(umLead.blocos[0].nomes[0], "lead sem resposta", "o singular do bloco de leads");
igual(umLead.blocos[0].nomes[1], "leads sem resposta", "o plural do bloco de leads");
ok(
  umLead.blocos.every((b) => typeof b.nomes[0] === "string" && typeof b.nomes[1] === "string"),
  "todo bloco carrega singular e plural como TEXTO (função não atravessa servidor→navegador)",
);

console.log(`${total - falhas}/${total} verificações passaram`);
if (falhas) process.exit(1);
