import { camposDaPerdaAoMudarEtapa, entraNaPerda } from "./perda-oportunidade";
import { diasParado, diasParadoDaLinha, ultimaAtividadePorRelacionamento } from "./oportunidade-parada";
import { normalizarTipoAtividade, normalizarTipoCompromisso } from "./tipo-atividade";
import { FUNIL_PADRAO, type EtapaFunil } from "./funil";

let falhas = 0;
function ok(desc: string, real: unknown, esperado: unknown) {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? "ok  " : "FALHA"} ${desc} -> ${JSON.stringify(real)}${bom ? "" : ` (esperado ${JSON.stringify(esperado)})`}`);
}

const f = FUNIL_PADRAO;
// 23h de domingo em Brasília = 02h de segunda em UTC: a data tem de ser domingo.
const noite = new Date("2026-11-23T02:00:00Z");

console.log("--- entrar e sair da perda ---");
ok("entrar grava data de SP, motivo e descrição",
  camposDaPerdaAoMudarEtapa("Negociação", "Perdidos", f, { motivo: "Sem Orçamento", descricao: "x" }, noite).banco,
  { data_perda: "2026-11-22", motivo_perda: "Sem Orçamento", descricao_perda: "x" });
ok("entrar sem motivo grava só a data", camposDaPerdaAoMudarEtapa("Follow-up", "Perdidos", f, {}, noite).banco, { data_perda: "2026-11-22" });
ok("sair da perda limpa os três", camposDaPerdaAoMudarEtapa("Perdidos", "Prospecção", f).banco,
  { motivo_perda: null, descricao_perda: null, data_perda: null });
ok("andar entre abertas não mexe", camposDaPerdaAoMudarEtapa("Prospecção", "Follow-up", f).banco, {});
ok("perda para perda não mexe", camposDaPerdaAoMudarEtapa("Perdidos", "Perdidos", f).banco, {});
const renomeado: EtapaFunil[] = f.map((e) => (e.tipo === "perda" ? { ...e, nome: "Não fechou" } : e));
ok("etapa de perda renomeada vale pelo papel", entraNaPerda("Negociação", "Não fechou", renomeado), true);
ok("nome antigo 'Perdidos' ainda é perda", entraNaPerda("Proposta", "Perdidos", renomeado), true);

console.log("\n--- dias parado ---");
const agora = new Date("2026-11-25T12:00:00Z");
ok("sem data nenhuma é 0", diasParado([null, undefined, ""], agora), 0);
ok("conta da mais recente", diasParado(["2026-11-01T12:00:00Z", "2026-11-15T12:00:00Z"], agora), 10);
ok("atividade recente zera o parado", diasParadoDaLinha({ updated_at: "2026-10-01T00:00:00Z" }, "2026-11-24T12:00:00Z", agora), 1);
ok("data futura dá 0", diasParado(["2026-12-01T00:00:00Z"], agora), 0);
const mapa = ultimaAtividadePorRelacionamento([
  { relacionamento_id: "a", ocorrida_em: "2026-11-01T00:00:00Z" },
  { relacionamento_id: "a", ocorrida_em: "2026-11-20T00:00:00Z" },
  { relacionamento_id: null, ocorrida_em: "2026-11-24T00:00:00Z" },
]);
ok("última atividade por cliente", [...mapa.entries()], [["a", "2026-11-20T00:00:00Z"]]);

console.log("\n--- tipos ---");
ok("E-mail vira Email", normalizarTipoAtividade("E-mail"), "Email");
ok("email vira Email", normalizarTipoAtividade("email"), "Email");
ok("ligacao vira Ligação", normalizarTipoAtividade("ligacao"), "Ligação");
ok("vazio vira Outro", normalizarTipoAtividade(""), "Outro");
ok("compromisso válido fica", normalizarTipoCompromisso("Reunião"), "Reunião");
ok("follow up vira Follow-up", normalizarTipoCompromisso("follow up"), "Follow-up");
ok("visita técnica vira Visita", normalizarTipoCompromisso("Visita técnica"), "Visita");
ok("ligar vira Ligação", normalizarTipoCompromisso("ligar para cliente"), "Ligação");
ok("desconhecido vira Outro", normalizarTipoCompromisso("almoço"), "Outro");
ok("sem tipo vira Outro", normalizarTipoCompromisso(undefined), "Outro");

console.log(falhas ? `\n${falhas} FALHA(S)` : "\ntudo certo");
if (falhas) process.exit(1);
