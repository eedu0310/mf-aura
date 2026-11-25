/**
 * Peças puras do painel do agente: a linha do tempo (falas + rodadas), o
 * agrupamento por dia em São Paulo, os filtros de achados e os ajustes de texto.
 *
 * Rodar com:
 *   node --experimental-strip-types --no-warnings --import <reg.mjs> src/lib/agentes/painel.teste.ts
 */
import {
  agruparPorDia,
  duracaoMs,
  filtrarAchados,
  juntarAtividade,
  linkInterno,
  ordenarAchados,
  primeiraLinha,
  rotuloDoDia,
  textoDuracao,
  truncar,
  type AchadoNoPainel,
  type FalaNoPainel,
  type RodadaNoPainel,
} from "./painel";

let passou = 0;
const falhas: string[] = [];
function conferir(oque: string, real: unknown, esperado: unknown) {
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a === b) passou += 1;
  else falhas.push(`${oque}\n  esperado: ${b}\n  veio:     ${a}`);
}

const fala = (id: string, em: string): FalaNoPainel => ({
  tipo: "fala",
  id,
  em,
  direcao: "enviou",
  tipoFala: "relato",
  de: { id: "followup", nome: "Follow-up", quem: "agente" },
  para: { id: "diretora", nome: "Diretora", quem: "agente" },
  texto: "oi",
  empresa: null,
});
const rodada = (id: string, em: string): RodadaNoPainel => ({
  tipo: "rodada",
  id,
  em,
  fim: null,
  status: "ok",
  resumo: "",
  achados: 0,
  custoUsd: 0,
  erro: null,
  duracaoMs: null,
});

// ---- linha do tempo
const junta = juntarAtividade(
  [fala("f1", "2026-11-25T10:00:00Z"), fala("f2", "2026-11-25T12:00:00Z"), fala("f1", "2026-11-25T10:00:00Z")],
  [rodada("r1", "2026-11-25T11:00:00Z"), rodada("r2", "2026-11-25T12:00:00Z")],
);
conferir("mais nova em cima, rodada antes da fala no empate, sem repetir", junta.map((i) => i.id), ["r2", "f2", "r1", "f1"]);
conferir("respeita o limite", juntarAtividade([fala("a", "2026-11-25T10:00:00Z")], [rodada("b", "2026-11-25T11:00:00Z")], 1).map((i) => i.id), ["b"]);
conferir("data inválida vai para o fim", juntarAtividade([fala("x", "lixo"), fala("y", "2026-01-01T00:00:00Z")], []).map((i) => i.id), ["y", "x"]);

// ---- dias em São Paulo (agora = 25/11/2026 às 10h de Brasília)
const agora = new Date("2026-11-25T13:00:00Z");
conferir("hoje", rotuloDoDia("2026-11-25", agora), "Hoje");
conferir("ontem", rotuloDoDia("2026-11-24", agora), "Ontem");
conferir("outro dia tem dia e mês", /23/.test(rotuloDoDia("2026-11-23", agora)) && /nov/i.test(rotuloDoDia("2026-11-23", agora)), true);
conferir("outro ano mostra o ano", /2025/.test(rotuloDoDia("2025-12-31", agora)), true);

const grupos = agruparPorDia(
  [
    { em: "2026-11-25T12:00:00Z" }, // 9h de Brasília, hoje
    { em: "2026-11-25T02:30:00Z" }, // 23h30 de ontem em Brasília (já é 25 em UTC)
    { em: "2026-11-24T15:00:00Z" }, // ontem
    { em: "2026-11-20T15:00:00Z" },
  ],
  agora,
);
conferir("agrupa pelo dia de Brasília, não de UTC", grupos.map((g) => [g.dia, g.itens.length]), [
  ["2026-11-25", 1],
  ["2026-11-24", 2],
  ["2026-11-20", 1],
]);
conferir("rótulos", grupos.slice(0, 2).map((g) => g.rotulo), ["Hoje", "Ontem"]);
conferir("lista vazia", agruparPorDia([], agora), []);

// ---- texto
conferir("primeira linha do erro", primeiraLinha("\n  Falhou: timeout\n\nlog 1\nlog 2"), "Falhou: timeout");
conferir("sem erro", primeiraLinha(null), null);
conferir("curto não corta", truncar("abc", 10), "abc");
conferir("corta no espaço com reticências", truncar("uma frase bem comprida demais", 20), "uma frase bem…");
conferir("corte respeita o limite", truncar("x".repeat(400), 300).length, 300);
conferir("duração", duracaoMs("2026-11-25T10:00:00Z", "2026-11-25T10:00:03Z"), 3000);
conferir("duração sem fim", duracaoMs("2026-11-25T10:00:00Z", null), null);
conferir("duração negativa vira null", duracaoMs("2026-11-25T10:00:03Z", "2026-11-25T10:00:00Z"), null);
conferir("texto da duração", [textoDuracao(3000), textoDuracao(125_000), textoDuracao(3_900_000), textoDuracao(null)], ["3 s", "2 min", "1 h 5 min", null]);
conferir("link interno passa", linkInterno("/relacionamentos?id=1"), "/relacionamentos?id=1");
conferir("link externo não", [linkInterno("https://x.com"), linkInterno("//x.com"), linkInterno("/\\x.com"), linkInterno(null)], [null, null, null, null]);

// ---- achados
const achado = (id: string, status: string, criadoEm: string, atualizadoEm: string | null = null): AchadoNoPainel => ({
  id,
  titulo: id,
  descricao: "",
  prioridade: "media",
  status,
  empresa: "Loja",
  destinatarioNome: null,
  criadoEm,
  atualizadoEm,
  acaoUrl: null,
});
const lista = [
  achado("a", "pendente", "2026-11-20T10:00:00Z"),
  achado("b", "concluida", "2026-11-19T10:00:00Z", "2026-11-25T10:00:00Z"),
  achado("c", "resolvida_sozinha", "2026-11-18T10:00:00Z"),
  achado("d", "dispensada", "2026-11-21T10:00:00Z"),
];
conferir("abertos", filtrarAchados(lista, "abertos").map((a) => a.id), ["a"]);
conferir("resolvidos", filtrarAchados(lista, "resolvidos").map((a) => a.id), ["b", "c"]);
conferir("todos", filtrarAchados(lista, "todos").length, 4);
conferir("ordem pelo último movimento", ordenarAchados(lista).map((a) => a.id), ["b", "d", "a", "c"]);

if (falhas.length) {
  console.error(`FALHOU ${falhas.length} (passou ${passou}):\n\n${falhas.join("\n\n")}`);
  process.exit(1);
}
console.log(`ok: ${passou} conferências`);
