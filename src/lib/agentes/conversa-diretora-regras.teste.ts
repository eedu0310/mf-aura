/**
 * A conversa do gestor com a Diretora: o que se aproveita da resposta da IA.
 *
 * Rodar com:
 *   node --experimental-strip-types --no-warnings --import <reg.mjs> src/lib/agentes/conversa-diretora-regras.teste.ts
 */
import {
  RESPOSTA_SEM_IA,
  interpretarRespostaDaDiretora,
  mensagemDaConversa,
  respostaPorRegra,
  textoDoGestor,
} from "./conversa-diretora-regras";
import { gestorDaFala, idNoEscritorioDoGestor } from "./util";

let passou = 0;
const falhas: string[] = [];
function conferir(oque: string, real: unknown, esperado: unknown) {
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a === b) passou += 1;
  else falhas.push(`${oque}\n  esperado: ${b}\n  veio:     ${a}`);
}

const CONFIG_OK = {
  fonte: "pos_vendas",
  filtroDescricao: "x",
  instrucoes: "y",
  agenda: { tipo: "diario", horas: [9] },
  destinatario: "pos_venda_da_loja",
  limitePorExecucao: 10,
};
const opcoes = {
  diretoraId: "diretora",
  agentes: new Map([
    ["followup", "Analista de Follow-up"],
    ["leads", "Guardião dos Leads"],
    ["pipeline", "Analista de Pipeline"],
    ["metas", "Analista de Metas"],
  ]),
  permitidos: [34, 3],
  validarConfig: (v: unknown) => (v && typeof v === "object" && (v as { fonte?: string }).fonte === "pos_vendas" ? (CONFIG_OK as never) : null),
};

// ---- texto do gestor
conferir("texto vazio", "erro" in textoDoGestor("   "), true);
conferir("texto não-string", "erro" in textoDoGestor(42), true);
conferir("texto longo demais", "erro" in textoDoGestor("a".repeat(2001)), true);
conferir("texto no limite passa", textoDoGestor(` ${"a".repeat(2000)} `), { texto: "a".repeat(2000) });

// ---- resposta da IA
const boa = interpretarRespostaDaDiretora(
  {
    resposta: "Boa ideia. Passei para o Analista de Follow-up olhar os 34 itens.",
    encaminhar: [
      { agenteId: "followup", pedido: "Priorize os clientes que pediram orçamento." },
      { agenteId: "followup", pedido: "repetido" },
      { agenteId: "diretora", pedido: "para mim mesma" },
      { agenteId: "inventado", pedido: "agente que não existe" },
      { agenteId: "leads", pedido: "Confira os 999 leads." },
      { agenteId: "pipeline", pedido: "" },
    ],
  },
  opcoes,
);
conferir("resposta boa passa", boa.resposta, "Boa ideia. Passei para o Analista de Follow-up olhar os 34 itens.");
conferir("só encaminha para agente real, sem repetir, sem número inventado", boa.encaminhar.map((e) => e.agenteId), ["followup"]);
conferir("sem proposta", boa.proposta, null);

conferir(
  "resposta com número inventado cai",
  interpretarRespostaDaDiretora({ resposta: "Vamos vender 50% mais." }, opcoes).resposta,
  null,
);
conferir("lixo da IA", interpretarRespostaDaDiretora(null, opcoes).resposta, null);
conferir("lista no lugar de objeto", interpretarRespostaDaDiretora([1, 2], opcoes).encaminhar, []);
const muitos = interpretarRespostaDaDiretora(
  {
    resposta: "Ok.",
    encaminhar: ["followup", "leads", "pipeline", "metas"].map((agenteId) => ({ agenteId, pedido: "Olhe isso." })),
  },
  opcoes,
);
conferir("no máximo 3 encaminhamentos", muitos.encaminhar.length, 3);

const comProposta = interpretarRespostaDaDiretora(
  {
    resposta: "Ninguém cobre isso; propus um agente novo.",
    proposta: { nome: "Vigia de garantia", setor: "pos-venda", missao: "Lembrar garantias.", justificativa: "Ninguém olha.", config: CONFIG_OK },
  },
  opcoes,
);
conferir("proposta válida vira PropostaAgente da Diretora", [comProposta.proposta?.propostoPor, comProposta.proposta?.setor], [
  "diretora",
  "pos-venda",
]);
conferir(
  "proposta com config insegura cai",
  interpretarRespostaDaDiretora(
    { resposta: "x", proposta: { nome: "X", setor: "vendas", missao: "m", config: { fonte: "profiles" } } },
    opcoes,
  ).proposta,
  null,
);
conferir(
  "proposta no setor da direção cai",
  interpretarRespostaDaDiretora({ resposta: "x", proposta: { nome: "X", setor: "direcao", missao: "m", config: CONFIG_OK } }, opcoes)
    .proposta,
  null,
);

// ---- resposta por regra
conferir("sem IA e sem encaminhamento", respostaPorRegra([]), RESPOSTA_SEM_IA);
conferir("por regra com 2 nomes", respostaPorRegra(["A", "B"]).includes("A e B"), true);

// ---- id do gestor no escritório
const uid = "1b4e28ba-2fa1-11d2-883f-0016d3cca427";
conferir("ida e volta do id", gestorDaFala(idNoEscritorioDoGestor(uid)), uid);
conferir("agente não é gestor", gestorDaFala("followup"), null);
conferir("prefixo sem uuid não vale", gestorDaFala("gestor:abc"), null);
conferir("null", gestorDaFala(null), null);

// ---- linha → mensagem
const g = idNoEscritorioDoGestor(uid);
conferir(
  "mensagem do gestor",
  mensagemDaConversa({ id: "1", de_agente: g, texto: "oi", criado_em: "2026-11-25T10:00:00Z", dados: {} }, g),
  { id: "1", autor: "gestor", texto: "oi", criadoEm: "2026-11-25T10:00:00Z" },
);
conferir(
  "resposta da Diretora com encaminhados e proposta",
  mensagemDaConversa(
    {
      id: "2",
      de_agente: "diretora",
      texto: "ok",
      criado_em: "2026-11-25T10:00:05Z",
      dados: {
        encaminhados: [{ agenteId: "leads", agenteNome: "Guardião dos Leads", pedido: "p" }, null],
        proposta: { nome: "Vigia", setor: "vendas", gravada: true },
        semIA: true,
      },
    },
    g,
  ),
  {
    id: "2",
    autor: "diretora",
    texto: "ok",
    criadoEm: "2026-11-25T10:00:05Z",
    encaminhados: [{ agenteId: "leads", agenteNome: "Guardião dos Leads", pedido: "p" }],
    proposta: { nome: "Vigia", setor: "vendas", gravada: true },
    semIA: true,
  },
);

if (falhas.length) {
  console.error(`${falhas.length} verificação(ões) falharam:\n\n${falhas.join("\n\n")}`);
  process.exit(1);
}
console.log(`${passou}/${passou} verificações passaram`);
