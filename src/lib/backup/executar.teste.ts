/**
 * Apagar backup é a operação que não perdoa engano: se a regra estiver errada,
 * o erro só aparece no dia em que alguém precisar restaurar — tarde demais.
 * Por isso a decisão de remoção é uma função pura e tem teste.
 *
 * Regra desde 27/11/2026 (pedido do dono): fica SÓ o backup mais recente — no
 * disco, no bucket e no Drive. O antigo só sai quando o novo do mesmo tipo já
 * está salvo; se o backup parar, o último que existe fica.
 */
import {
  antigosParaApagar,
  pastasAntigasNoDrive,
  diaDoArquivo,
  diaDasSessoes,
  diaDoSistema,
  diaDoBackup,
  nomesDoDia,
  EXCLUIDOS_DO_SISTEMA,
} from "./executar";

let passou = 0;
const falhas: string[] = [];
function conferir(oque: string, real: unknown, esperado: unknown) {
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a === b) passou += 1;
  else falhas.push(`${oque}\n  esperado: ${b}\n  veio:     ${a}`);
}

const HOJE = "2026-11-27";
const TUDO_OK = { dados: true, sessoes: true, sistema: true };
const NADA_OK = { dados: false, sessoes: false, sistema: false };

// ---- só mexe em arquivo nosso
conferir("reconhece o nosso arquivo", diaDoArquivo("aura-2026-10-13.json.gz"), "2026-10-13");
conferir("ignora arquivo de terceiro", diaDoArquivo("dump-producao.sql.gz"), null);
conferir("ignora o temporário", diaDoArquivo("aura-2026-10-13.json.gz.tmp"), null);
conferir("ignora nome parecido", diaDoArquivo("aura-2026-13.json.gz"), null);
conferir("ignora pasta", diaDoArquivo("_antigos"), null);

// ---- nomes dos três arquivos de um dia
{
  const n = nomesDoDia(HOJE);
  conferir("nome dos dados", n.dados, "aura-2026-11-27.json.gz");
  conferir("nome das sessões", n.sessoes, "aura-sessoes-2026-11-27.tar.gz");
  conferir("nome do sistema", n.sistema, "aura-sistema-2026-11-27.tar.gz");
  conferir("diaDasSessoes lê o próprio nome", diaDasSessoes(n.sessoes), HOJE);
  conferir("diaDoSistema lê o próprio nome", diaDoSistema(n.sistema), HOJE);
  conferir("diaDasSessoes recusa dados e sistema", [diaDasSessoes(n.dados), diaDasSessoes(n.sistema)], [null, null]);
  conferir("diaDoSistema recusa dados e sessões", [diaDoSistema(n.dados), diaDoSistema(n.sessoes)], [null, null]);
  conferir("diaDoArquivo recusa sessões e sistema", [diaDoArquivo(n.sessoes), diaDoArquivo(n.sistema)], [null, null]);
  conferir("diaDoBackup reconhece os três", [n.dados, n.sessoes, n.sistema].map(diaDoBackup), [HOJE, HOJE, HOJE]);
}

// ---- só o mais recente fica
const dias = ["2026-11-20", "2026-11-25", "2026-11-26", HOJE];
const todos = dias.flatMap((d) => Object.values(nomesDoDia(d)));
const comTerceiro = [...todos, "anotacao.txt", "aura-2026-11-27.json.gz.tmp"];

{
  const apagar = antigosParaApagar(comTerceiro, HOJE, TUDO_OK);
  conferir("hoje salvo: apaga TODOS os dias anteriores (9 arquivos)", apagar.length, 9);
  conferir("hoje salvo: sobram só os três de hoje", comTerceiro.filter((n) => diaDoBackup(n) && !apagar.includes(n)), Object.values(nomesDoDia(HOJE)));
  conferir("nunca apaga o de hoje", apagar.some((n) => n.includes(HOJE)), false);
  conferir("nunca apaga arquivo que não é nosso", apagar.some((n) => n === "anotacao.txt" || n.endsWith(".tmp")), false);
}

{
  // "Fez backup hoje e daqui a 5 dias não foi feito": o último fica.
  const so20 = Object.values(nomesDoDia("2026-11-20"));
  conferir("backup parado há dias: o último que existe NÃO sai", antigosParaApagar(so20, HOJE, NADA_OK), []);
  conferir("backup parado: de vários antigos, fica o mais novo de cada tipo",
    antigosParaApagar(todos.filter((n) => !n.includes(HOJE)), HOJE, NADA_OK).sort(),
    ["aura-2026-11-20.json.gz", "aura-2026-11-25.json.gz", "aura-sessoes-2026-11-20.tar.gz", "aura-sessoes-2026-11-25.tar.gz", "aura-sistema-2026-11-20.tar.gz", "aura-sistema-2026-11-25.tar.gz"]);
}

{
  // Cada tipo por conta própria: as sessões falharem não segura o banco.
  const apagar = antigosParaApagar(todos, HOJE, { dados: true, sessoes: false, sistema: true });
  conferir("sessões de hoje falharam: fica a de ontem", apagar.includes("aura-sessoes-2026-11-26.tar.gz"), false);
  conferir("sessões de hoje falharam: as mais velhas saem", apagar.includes("aura-sessoes-2026-11-25.tar.gz"), true);
  conferir("o banco antigo sai mesmo assim", apagar.includes("aura-2026-11-26.json.gz"), true);
}

conferir("lista vazia não quebra", antigosParaApagar([], HOJE, TUDO_OK), []);

// ---- Drive: pastas por dia
{
  const pastas = ["2026-11-20/", "2026-11-26/", "2026-11-27/", "Importante/", ""];
  conferir("Drive: hoje subiu inteiro, saem as pastas dos dias anteriores", pastasAntigasNoDrive(pastas, HOJE, true), ["2026-11-20", "2026-11-26"]);
  conferir("Drive: hoje falhou, nada sai", pastasAntigasNoDrive(pastas, HOJE, false), []);
  conferir("Drive: pasta com outro nome nunca é tocada", pastasAntigasNoDrive(pastas, HOJE, true).includes("Importante"), false);
  conferir("Drive: só a de hoje, nada a apagar", pastasAntigasNoDrive(["2026-11-27/"], HOJE, true), []);
}

// ---- o pacote do sistema leva o programa, não o que se refaz sozinho
conferir("node_modules e .next ficam de fora", ["node_modules", ".next", ".backups", ".whatsapp-sessions"].every((p) => EXCLUIDOS_DO_SISTEMA.includes(p)), true);
conferir("o código e o .git não ficam de fora", ["src", ".git", "supabase", "deploy"].some((p) => EXCLUIDOS_DO_SISTEMA.includes(p)), false);

if (falhas.length) {
  console.error(`${falhas.length} verificação(ões) falharam:\n\n${falhas.join("\n\n")}`);
  process.exit(1);
}
console.log(`${passou}/${passou} verificações passaram`);
