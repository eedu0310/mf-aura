/**
 * Testes da regra do Analista de Follow-up (sem banco).
 */
import { FUNIL_PADRAO } from "@/lib/funil";
import {
  achadoDeFollowup, classificarFollowup, ordenarFollowups, prioridadeFollowup, type ItemFollowup, type OpFollowup, type RelFollowup,
} from "./followup";

let falhas = 0;
function ok(desc: string, real: unknown, esperado: unknown) {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? "ok  " : "FALHA"} ${desc} -> ${JSON.stringify(real)}${bom ? "" : ` (esperado ${JSON.stringify(esperado)})`}`);
}

const AGORA = Date.parse("2026-11-25T10:40:00-03:00");
const DIA = 86_400_000;
const iso = (diasAtras: number) => new Date(AGORA - diasAtras * DIA).toISOString();

const rel = (p: Partial<RelFollowup>): RelFollowup => ({
  id: "r1", owner_id: "ana", empresa: "LF Lareiras", nome: "Cliente", categoria: "Cliente Final",
  proximo_contato_em: null, ultimo_contato_em: iso(3), created_at: iso(100), observacao: null, ...p,
});
const op = (p: Partial<OpFollowup>): OpFollowup => ({
  id: "o1", owner_id: "ana", empresa: "LF Lareiras", relacionamento_id: "r1", cliente: "Cliente", valor: 0, etapa: "Follow-up", ...p,
});
const classe = (r: RelFollowup, ops: OpFollowup[] = []) => classificarFollowup(r, ops, FUNIL_PADRAO, AGORA);

console.log("--- vencido ---");
ok("próximo contato há 3 dias = vencido", classe(rel({ proximo_contato_em: iso(3) }))?.tipo, "vencido");
ok("conta os dias de atraso", classe(rel({ proximo_contato_em: iso(3) }))?.dias, 3);
ok("marcado para hoje cedo (meio dia de folga) não vence", classe(rel({ proximo_contato_em: iso(0.3) })), null);
ok("marcado para amanhã: nada a cobrar", classe(rel({ proximo_contato_em: iso(-1) }), [op({})]), null);

console.log("\n--- negócio aberto sem próximo contato ---");
const semProx = classe(rel({ ultimo_contato_em: iso(9) }), [op({ valor: 18000, etapa: "Negociação" })]);
ok("negócio aberto sem data = sem_proximo", semProx?.tipo, "sem_proximo");
ok("leva o valor do negócio", semProx?.valorAberto, 18000);
ok("e a etapa mais avançada", semProx?.etapa, "Negociação");
ok("Negociação com valor é alta", semProx && prioridadeFollowup(semProx), "alta");
ok("Prospecção sem valor é média", prioridadeFollowup(classe(rel({}), [op({ etapa: "Prospecção" })]) as ItemFollowup), "media");

console.log("\n--- esfriando ---");
ok("arquiteto 20 dias sem contato esfria", classe(rel({ categoria: "Arquiteto", ultimo_contato_em: iso(20) }))?.tipo, "esfriando");
ok("arquiteto 10 dias ainda não", classe(rel({ categoria: "Arquiteto", ultimo_contato_em: iso(10) })), null);
ok("cliente final sem negócio fica de fora (é da Reativação)", classe(rel({ ultimo_contato_em: iso(40) })), null);
ok("sem último contato conta desde o cadastro", classe(rel({ categoria: "Construtora", ultimo_contato_em: null, created_at: iso(16) }))?.dias, 16);
ok("parceiro com 30+ dias sobe para média", prioridadeFollowup(classe(rel({ categoria: "Arquiteto", ultimo_contato_em: iso(35) })) as ItemFollowup), "media");

console.log("\n--- ordem e card ---");
const itens = [
  classe(rel({ id: "a", proximo_contato_em: iso(10) })),
  classe(rel({ id: "b", proximo_contato_em: iso(2) }), [op({ relacionamento_id: "b", valor: 5000 })]),
  classe(rel({ id: "c", proximo_contato_em: iso(1) }), [op({ relacionamento_id: "c", valor: 30000, etapa: "Negociação" })]),
] as ItemFollowup[];
ok("ordena pelo dinheiro em jogo", ordenarFollowups(itens).map((i) => i.rel.id), ["c", "b", "a"]);
ok("vencido há mais de 7 dias sem valor ainda é alta", prioridadeFollowup(itens[0]), "alta");
const card = achadoDeFollowup(itens[2], "ana");
ok("chave estável por cliente", card.chave, "followup:vencido:c");
ok("card leva ao cliente", card.acaoUrl, "/relacionamentos?id=c");
ok("card oferece gerar mensagem", card.podeGerarMensagem, true);

console.log(falhas === 0 ? "\nTUDO PASSOU" : `\n${falhas} FALHA(S)`);
process.exit(falhas ? 1 : 0);
