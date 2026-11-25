/**
 * Testes das peças comuns dos agentes: o corte por pessoa, a rota de quem
 * recebe (dono → gestor da loja → só resumo para o mestre) e a limpeza de
 * dados pessoais antes da IA.
 */
import type { Achado, Prioridade } from "../tipos";
import { chaveDe, limitarPorPessoa, limparPII, montarResponsaveis, type LinhaPerfil } from "./comum";

let falhas = 0;
function ok(desc: string, real: unknown, esperado: unknown) {
  const bom = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bom) falhas++;
  console.log(`${bom ? "ok  " : "FALHA"} ${desc} -> ${JSON.stringify(real)}${bom ? "" : ` (esperado ${JSON.stringify(esperado)})`}`);
}

function achado(chave: string, destinatarioId: string, prioridade: Prioridade): Achado {
  return { chave, empresa: "LF Lareiras", destinatarioId, titulo: chave, descricao: "", prioridade, expiraEmDias: 1 };
}

console.log("--- limitarPorPessoa ---");
{
  const lista: Achado[] = [];
  for (let i = 0; i < 15; i++) lista.push(achado(`a${i}`, "ana", i === 12 ? "urgente" : "media"));
  lista.push(achado("b0", "beto", "baixa"));
  const { achados, cortados } = limitarPorPessoa(lista);
  ok("no máximo 10 para a Ana", achados.filter((a) => a.destinatarioId === "ana").length, 10);
  ok("o urgente entra mesmo vindo no fim", achados.some((a) => a.chave === "a12"), true);
  ok("o urgente vem primeiro", achados[0].chave, "a12");
  ok("dentro da mesma prioridade, a ordem de entrada", achados.slice(1, 4).map((a) => a.chave), ["a0", "a1", "a2"]);
  ok("o Beto não é afetado pela Ana", achados.filter((a) => a.destinatarioId === "beto").length, 1);
  ok("conta os cortados", cortados, 5);
}
{
  const { achados } = limitarPorPessoa([achado("x", "ana", "alta"), achado("x", "ana", "baixa"), achado("y", "", "alta")]);
  ok("chave repetida entra uma vez", achados.length, 1);
  ok("sem destinatário é descartado", achados.some((a) => a.chave === "y"), false);
}
{
  const { achados } = limitarPorPessoa([achado("a", "ana", "alta"), achado("b", "ana", "media"), achado("c", "ana", "urgente")], 2);
  ok("teto configurável fica com os 2 mais importantes", achados.map((a) => a.chave), ["c", "a"]);
}

console.log("\n--- quem recebe ---");
const perfil = (p: Partial<LinhaPerfil> & { id: string }): LinhaPerfil => ({
  nome: p.id, empresa: "LF Lareiras", cargo: "Vendedor", ativo: true, gestor_mestre: false, gestor_aprovado: false, excluido_em: null, ...p,
});
const equipe = montarResponsaveis([
  perfil({ id: "vend-lf" }),
  perfil({ id: "saiu", ativo: false }),
  perfil({ id: "apagado", excluido_em: "2026-11-01" }),
  perfil({ id: "gestor-ag", empresa: "A&G Aquecimento", cargo: "Gestor", gestor_aprovado: true }),
  perfil({ id: "gestor-sem-aprovacao", empresa: "Sole Aquecimento", cargo: "Gestor" }),
  perfil({ id: "mestre", empresa: "MF International", cargo: "Gestor", gestor_aprovado: true, gestor_mestre: true }),
  perfil({ id: "pv-ag", empresa: "A&G Aquecimento", cargo: "Pós-venda" }),
]);
ok("dono ativo recebe o item", equipe.destinoDoItem("vend-lf", "LF Lareiras"), "vend-lf");
ok("dono inativo → gestor da loja", equipe.destinoDoItem("saiu", "A&G Aquecimento"), "gestor-ag");
ok("dono excluído em loja sem gestor → ninguém (vai no resumo do mestre)", equipe.destinoDoItem("apagado", "LF Lareiras"), null);
ok("gestor sem aprovação não conta", equipe.gestoresDaLoja("Sole Aquecimento").length, 0);
ok("loja sem gestor cai nos mestres, marcado", equipe.gestoresPara("Sole Aquecimento"), { ids: ["mestre"], mestres: true });
ok("mestre não é gestor 'da loja' dele", equipe.gestoresPara("MF International"), { ids: ["mestre"], mestres: true });
ok("pós-venda da loja vem antes do gestor", equipe.posVendaPara("A&G Aquecimento"), { ids: ["pv-ag"], mestres: false });
ok("sem pós-venda → gestor da loja", equipe.marketingPara("A&G Aquecimento"), { ids: ["gestor-ag"], mestres: false });
ok("vendedores só os ativos", equipe.vendedores().map((p) => p.id), ["vend-lf"]);

console.log("\n--- limparPII e chaves ---");
ok(
  "tira telefone, e-mail e nome",
  limparPII("João Silva (51) 99876-5432 joao@x.com.br achou caro", ["João Silva"]),
  "o cliente o cliente [telefone] [email] achou caro",
);
ok("nome com acento no fim também sai", limparPII("José pediu orçamento", ["José"]), "o cliente pediu orçamento");
ok("mantém número curto (preço, medida)", limparPII("lareira de 90 cm por 12 mil"), "lareira de 90 cm por 12 mil");
ok("chave junta as partes e pula vazias", chaveDe("followup", "vencido", null, "abc"), "followup:vencido:abc");

console.log(falhas === 0 ? "\nTUDO PASSOU" : `\n${falhas} FALHA(S)`);
process.exit(falhas ? 1 : 0);
