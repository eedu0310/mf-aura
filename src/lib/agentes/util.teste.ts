/**
 * Peças do motor que protegem contra a IA e contra o banco sem a 108, mais
 * as contas do Guardião (o que apagar, o que é queda).
 *
 * Rodar com:
 *   node --experimental-strip-types --no-warnings --import <reg.mjs> src/lib/agentes/util.teste.ts
 */
import { faltaNoBanco, lerJsonDaIA, numerosConferem, numerosDoTexto, slug } from "./util";
import { diasParaApagar, quedasDeConhecimento } from "./guardiao";

let passou = 0;
const falhas: string[] = [];
function conferir(oque: string, real: unknown, esperado: unknown) {
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a === b) passou += 1;
  else falhas.push(`${oque}\n  esperado: ${b}\n  veio:     ${a}`);
}

// ---- JSON da IA
conferir("JSON limpo", lerJsonDaIA('{"a":1}'), { a: 1 });
conferir("com cerca de código", lerJsonDaIA('```json\n{"a":2}\n```'), { a: 2 });
conferir("com texto em volta", lerJsonDaIA('Claro! Aqui está: {"achados": []} Espero ajudar.'), { achados: [] });
conferir("lista vira itens", lerJsonDaIA('[{"id":"x"}]'), { itens: [{ id: "x" }] });
conferir("quebrado vira null", lerJsonDaIA('{"a": '), null);
conferir("vazio vira null", lerJsonDaIA(""), null);

// ---- números do texto (regra 5 do contrato)
conferir("números pt-BR", numerosDoTexto("Foram 1.234 itens, 12,5% e 7h20."), ["1234", "12.5", "7", "20"]);
conferir("confere quando todos vieram dos dados", numerosConferem("Hoje são 34 itens com 3 pessoas.", [34, 3]), true);
conferir("pega número inventado", numerosConferem("Hoje são 34 itens e 90% resolvidos.", [34]), false);
conferir("texto sem número passa", numerosConferem("Bom dia, equipe.", []), true);

// ---- banco sem a 108
conferir("42P01", faltaNoBanco({ code: "42P01", message: "relation does not exist" }), true);
conferir("PGRST205", faltaNoBanco({ code: "PGRST205", message: "Could not find the table" }), true);
conferir("coluna 42703", faltaNoBanco({ code: "42703" }), true);
conferir("outro erro não", faltaNoBanco({ code: "23505", message: "duplicate key" }), false);
conferir("sem erro não", faltaNoBanco(null), false);

conferir("slug", slug("Caçador de orçamentos esquecidos!"), "cacador-de-orcamentos-esquecidos");

// ---- Guardião: retenção de um ano, nunca o de hoje
conferir(
  "apaga só o que passou de 365 dias",
  diasParaApagar(["2025-11-24", "2025-11-25", "2025-11-26", "2026-11-25"], "2026-11-25"),
  ["2025-11-24"],
);
conferir("hoje nunca", diasParaApagar(["2026-11-25"], "2026-11-25", 0), []);

// ---- Guardião: queda de mais de 5%
conferir(
  "queda acima de 5% alerta; abaixo não; tabela nova não",
  quedasDeConhecimento(
    { aura_materiais: 35, perguntas_frequentes: 116, playbook: 1 },
    { aura_materiais: 30, perguntas_frequentes: 112, playbook: 1, treinamentos: 148 },
  ).map((q) => q.tabela),
  ["aura_materiais"],
);
conferir("playbook sumiu = 100%", quedasDeConhecimento({ playbook: 1 }, { playbook: 0 }).map((q) => q.queda), [1]);

if (falhas.length) {
  console.error(`${falhas.length} verificação(ões) falharam:\n\n${falhas.join("\n\n")}`);
  process.exit(1);
}
console.log(`${passou}/${passou} verificações passaram`);
