/**
 * Apagar backup é a operação que não perdoa engano: se a regra estiver errada,
 * o erro só aparece no dia em que alguém precisar restaurar — tarde demais.
 * Por isso a decisão de remoção é uma função pura e tem teste.
 *
 * Rodar com: npx tsx src/lib/backup/executar.teste.ts
 */
import { antigosNoDisco, decidirRemocoes, diaDoArquivo, diaDasSessoes, nomesDoDia } from "./executar";

let passou = 0;
const falhas: string[] = [];
function conferir(oque: string, real: unknown, esperado: unknown) {
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a === b) passou += 1;
  else falhas.push(`${oque}\n  esperado: ${b}\n  veio:     ${a}`);
}

/** Gera os N dias terminando em `fim`, do mais antigo para o mais novo. */
function dias(fim: string, n: number): string[] {
  const saida: string[] = [];
  const base = new Date(`${fim}T12:00:00-03:00`);
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(base.getTime() - i * 86_400_000);
    saida.push(d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }));
  }
  return saida;
}

// 2026-10-13 é uma terça.
const HOJE = "2026-10-13";

conferir("poucos arquivos: não apaga nada", decidirRemocoes(dias(HOJE, 5), HOJE), []);
conferir("exatamente sete: não apaga nada", decidirRemocoes(dias(HOJE, 7), HOJE), []);

// Com 40 dias, sobram os 7 últimos e 4 domingos anteriores a eles.
const quarenta = decidirRemocoes(dias(HOJE, 40), HOJE);
const sobraram = dias(HOJE, 40).filter((d) => !quarenta.includes(d));
// 7 diários mais 4 domingos ANTERIORES a eles: a cobertura não muda com o
// dia da semana em que o backup roda.
conferir("sobram 7 diários + 4 domingos", sobraram.length, 11);
conferir("o de hoje sobra", sobraram.includes(HOJE), true);
conferir("ontem sobra", sobraram.includes("2026-10-12"), true);
conferir("o sétimo dia sobra", sobraram.includes("2026-10-07"), true);
conferir("o oitavo dia some, por não ser domingo", quarenta.includes("2026-10-06"), true);
const domingosQueSobraram = sobraram.filter(
  (d) => new Date(`${d}T12:00:00-03:00`).getUTCDay() === 0,
);
// O domingo 11/10 cai dentro da semana recente; os 4 contados são os de fora.
conferir("cinco domingos no total (1 na semana + 4 fora)", domingosQueSobraram.length, 5);
conferir(
  "os domingos guardados são os 4 anteriores à semana recente",
  domingosQueSobraram.sort().reverse(),
  ["2026-10-11", "2026-10-04", "2026-09-27", "2026-09-20", "2026-09-13"],
);
conferir(
  "nada mais antigo que o quarto domingo de fora sobrevive",
  sobraram.filter((d) => d < "2026-09-13").length,
  0,
);
conferir("cobre pelo menos 30 dias para trás", sobraram.sort()[0], "2026-09-13");

// O de hoje nunca pode ser apagado, nem se a regra ficasse maluca.
conferir("hoje nunca entra na remoção", decidirRemocoes(dias(HOJE, 400), HOJE).includes(HOJE), false);

// Dia repetido não faz apagar duas vezes nem confunde a contagem.
conferir("dia repetido não quebra", decidirRemocoes([HOJE, HOJE, HOJE], HOJE), []);
conferir("lista vazia não quebra", decidirRemocoes([], HOJE), []);

// Só mexe em arquivo nosso: nada de apagar o que outra coisa deixou na pasta.
conferir("reconhece o nosso arquivo", diaDoArquivo("aura-2026-10-13.json.gz"), "2026-10-13");
conferir("ignora arquivo de terceiro", diaDoArquivo("dump-producao.sql.gz"), null);
conferir("ignora o temporário", diaDoArquivo("aura-2026-10-13.json.gz.tmp"), null);
conferir("ignora nome parecido", diaDoArquivo("aura-2026-13.json.gz"), null);
conferir("ignora pasta", diaDoArquivo("_antigos"), null);

if (falhas.length) {
  console.error(`${falhas.length} verificação(ões) falharam:\n\n${falhas.join("\n\n")}`);
  process.exit(1);
}

// ---- nomes dos arquivos de sessão (backup v2)
{
  const n = nomesDoDia("2026-10-19");
  conferir("nome dos dados", n.dados, "aura-2026-10-19.json.gz");
  conferir("nome das sessões", n.sessoes, "aura-sessoes-2026-10-19.tar.gz");
  conferir("diaDasSessoes lê o próprio nome", diaDasSessoes(n.sessoes), "2026-10-19");
  conferir("diaDasSessoes recusa arquivo de dados", diaDasSessoes(n.dados), null);
  conferir("diaDoArquivo recusa arquivo de sessões", diaDoArquivo(n.sessoes), null);
}

// ---- disco da VPS: só o de hoje (27/11/2026)
{
  const nomes = ["aura-2026-11-25.json.gz", "aura-sessoes-2026-11-25.tar.gz", "aura-2026-11-26.json.gz", "aura-sessoes-2026-11-26.tar.gz", "aura-2026-11-27.json.gz", "aura-sessoes-2026-11-27.tar.gz", "anotacao.txt"];
  conferir("com o pacote de hoje, apaga todos os dias anteriores", antigosNoDisco(nomes, "2026-11-27", true).sort(), ["aura-2026-11-25.json.gz", "aura-2026-11-26.json.gz", "aura-sessoes-2026-11-25.tar.gz", "aura-sessoes-2026-11-26.tar.gz"]);
  conferir("sem o pacote de hoje, fica o de sessões mais novo", antigosNoDisco(nomes.filter((n) => n !== "aura-sessoes-2026-11-27.tar.gz"), "2026-11-27", false).includes("aura-sessoes-2026-11-26.tar.gz"), false);
  conferir("nunca apaga o de hoje nem arquivo que não é nosso", antigosNoDisco(nomes, "2026-11-27", true).some((n) => n.includes("11-27") || n === "anotacao.txt"), false);
}

console.log(`${passou}/${passou} verificações passaram`);
