import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Backup noturno do banco.
 *
 * ONDE E POR QUÊ: o banco vive no Supabase e a aplicação na VPS. Gravar o
 * arquivo no disco da VPS já coloca a cópia em outra casa — se o Supabase cair
 * ou alguém apagar dado por engano, o arquivo está em outro fornecedor.
 * Guardar dentro do próprio banco não seria backup, e o Google Drive exigiria
 * credencial OAuth que vence e falha calada: a classe de erro que mais dói,
 * porque ninguém descobre que o backup parou até precisar dele.
 */

export const PASTA_PADRAO = path.join(process.cwd(), ".backups");

/** Diários que ficam. Uma semana cobre o "deu um problema ontem". */
export const DIARIOS_MANTIDOS = 7;
/** Domingos além disso: o problema que só aparece dez dias depois. */
export const DOMINGOS_MANTIDOS = 4;

const PAGINA = 1000;

export interface ResultadoBackup {
  arquivo: string;
  bytes: number;
  tabelas: number;
  linhas: number;
  apagados: string[];
}

function diaBR(quando = new Date()) {
  return quando.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/**
 * Lê uma tabela inteira em páginas.
 *
 * Sem paginar, o PostgREST corta em mil linhas e o backup sairia
 * silenciosamente incompleto — o pior tipo, o que só parece existir.
 */
async function lerTabela(sb: SupabaseClient, tabela: string): Promise<Record<string, unknown>[]> {
  const todas: Record<string, unknown>[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await sb.from(tabela).select("*").range(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    const lote = data ?? [];
    todas.push(...lote);
    if (lote.length < PAGINA) break;
  }
  return todas;
}

/** AAAA-MM-DD do nome do arquivo, ou null se não for um backup nosso. */
export function diaDoArquivo(nome: string): string | null {
  const m = /^aura-(\d{4}-\d{2}-\d{2})\.json\.gz$/.exec(nome);
  return m ? m[1] : null;
}

function ehDomingo(dia: string) {
  return new Date(`${dia}T12:00:00-03:00`).getUTCDay() === 0;
}

/**
 * Decide o que apagar.
 *
 * Separada da gravação de propósito: apagar backup é a parte que não perdoa
 * engano, então ela é uma função pura, testável sem tocar em disco nenhum.
 */
export function decidirRemocoes(
  dias: string[],
  hoje: string,
  diarios = DIARIOS_MANTIDOS,
  domingos = DOMINGOS_MANTIDOS,
): string[] {
  const ordenados = [...new Set(dias)].sort().reverse();
  const guardar = new Set<string>([hoje]);

  const recentes = ordenados.slice(0, diarios);
  for (const d of recentes) guardar.add(d);

  /*
   * Os domingos são contados FORA da janela diária, de propósito.
   *
   * Contando junto, um domingo que caísse dentro da semana recente gastava uma
   * das vagas e a profundidade do backup encolhia conforme o dia da semana em
   * que estivéssemos: numa terça o arquivo mais antigo era de 23 dias, noutro
   * dia seria de 30. Fora da janela, a cobertura é sempre a mesma.
   */
  let n = 0;
  for (const d of ordenados.slice(diarios)) {
    if (n >= domingos) break;
    if (ehDomingo(d)) {
      guardar.add(d);
      n += 1;
    }
  }
  return ordenados.filter((d) => !guardar.has(d));
}

export async function executarBackup(
  sb: SupabaseClient,
  pasta = PASTA_PADRAO,
  quando = new Date(),
): Promise<ResultadoBackup> {
  const dia = diaBR(quando);

  const { data: lista, error: erroLista } = await sb.rpc("tabelas_para_backup");
  if (erroLista) throw new Error(`Não consegui listar as tabelas: ${erroLista.message}`);
  const tabelas = (lista ?? []).map((t: { tabela: string }) => String(t.tabela));
  if (tabelas.length === 0) throw new Error("A lista de tabelas voltou vazia; backup abortado.");

  const conteudo: Record<string, unknown[]> = {};
  const falhas: string[] = [];
  let linhas = 0;
  for (const tabela of tabelas) {
    try {
      const dados = await lerTabela(sb, tabela);
      conteudo[tabela] = dados;
      linhas += dados.length;
    } catch (e) {
      falhas.push(`${tabela}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /*
   * Falhou em ler alguma tabela? Não grava nada. Um arquivo com metade do
   * banco e nome de backup é pior do que arquivo nenhum: na hora do aperto,
   * ele dá a sensação de que o dado está salvo.
   */
  if (falhas.length > 0) {
    throw new Error(`Backup abortado, não consegui ler: ${falhas.join(" | ")}`);
  }

  fs.mkdirSync(pasta, { recursive: true });
  const arquivo = path.join(pasta, `aura-${dia}.json.gz`);
  const corpo = JSON.stringify({ gerado_em: new Date().toISOString(), dia, versao: 1, tabelas: conteudo });
  /*
   * Grava em temporário e renomeia. Se a VPS cair no meio da escrita, não
   * sobra um .gz truncado com cara de backup bom.
   */
  const temporario = `${arquivo}.tmp`;
  fs.writeFileSync(temporario, zlib.gzipSync(Buffer.from(corpo, "utf8")));
  fs.renameSync(temporario, arquivo);
  const bytes = fs.statSync(arquivo).size;

  const existentes = fs.readdirSync(pasta).map(diaDoArquivo).filter((d): d is string => d !== null);
  const apagados: string[] = [];
  for (const d of decidirRemocoes(existentes, dia)) {
    try {
      fs.unlinkSync(path.join(pasta, `aura-${d}.json.gz`));
      apagados.push(d);
    } catch {
      /* já não estava lá */
    }
  }

  return { arquivo, bytes, tabelas: tabelas.length, linhas, apagados };
}
