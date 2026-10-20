import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { spawnSync } from "node:child_process";
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
  /** Tamanho do SQL do esquema que foi junto (0 = não veio). */
  esquemaBytes: number;
  /** Quantas migrações aplicadas foram junto. */
  migracoes: number;
  /** Arquivo .tar.gz com as sessões do WhatsApp, ou null se não havia pasta. */
  sessoes: string | null;
  /** O que subiu para o Supabase Storage (bucket "backups"), ou o motivo de não ter subido. */
  nuvem: { enviados: string[]; apagados: string[]; erro: string | null };
}

/** Bucket privado criado na migração 088. Só o service_role lê e grava. */
export const BUCKET_NUVEM = "backups";

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

/** AAAA-MM-DD do arquivo de sessões do WhatsApp, ou null. */
export function diaDasSessoes(nome: string): string | null {
  const m = /^aura-sessoes-(\d{4}-\d{2}-\d{2})\.tar\.gz$/.exec(nome);
  return m ? m[1] : null;
}

/** Nomes dos dois arquivos de um dia. */
export function nomesDoDia(dia: string) {
  return { dados: `aura-${dia}.json.gz`, sessoes: `aura-sessoes-${dia}.tar.gz` };
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

/**
 * Esquema (DDL) e migrações, via as funções da migração 088.
 *
 * Por quê: dados sem esquema não se restauram. Antes o backup tinha as linhas
 * de cada tabela, mas as tabelas, triggers e políticas só existiam dentro do
 * Supabase — perdido o projeto, ninguém recriava a casa para pôr os dados.
 * Se as funções não existirem (migração 088 não aplicada), o backup avisa e
 * segue sem esquema em vez de parar: dados sem esquema ainda valem mais do
 * que nada.
 */
async function lerEsquema(sb: SupabaseClient): Promise<{ esquema: string; migracoes: unknown[]; aviso: string | null }> {
  const [ddl, mig] = await Promise.all([sb.rpc("aura_esquema_ddl"), sb.rpc("aura_migracoes")]);
  const avisos: string[] = [];
  if (ddl.error) avisos.push(`esquema: ${ddl.error.message}`);
  if (mig.error) avisos.push(`migrações: ${mig.error.message}`);
  return {
    esquema: typeof ddl.data === "string" ? ddl.data : "",
    migracoes: Array.isArray(mig.data) ? mig.data : [],
    aviso: avisos.length ? avisos.join(" | ") : null,
  };
}

/**
 * Empacota as pastas de sessão do WhatsApp (.whatsapp-sessions) num .tar.gz.
 *
 * Fora do backup, perder a VPS significava 12 pessoas pareando o celular de
 * novo. O log de diagnóstico fica de fora: cresce, não serve para restaurar.
 * Usa o `tar` do sistema; na VPS (Linux) ele sempre existe. Se não existir
 * (Windows de desenvolvimento), devolve null em vez de quebrar o backup.
 */
function empacotarSessoes(pastaSessoes: string, destino: string): string | null {
  if (!fs.existsSync(pastaSessoes)) return null;
  const temporario = `${destino}.tmp`;
  const r = spawnSync(
    "tar",
    ["-czf", temporario, "--exclude=diagnostico.log", "-C", path.dirname(pastaSessoes), path.basename(pastaSessoes)],
    { stdio: "ignore" },
  );
  if (r.status !== 0) {
    try { fs.unlinkSync(temporario); } catch { /* não chegou a existir */ }
    return null;
  }
  fs.renameSync(temporario, destino);
  return destino;
}

/**
 * Sobe os arquivos do dia para o bucket "backups" e aplica lá a mesma
 * retenção do disco.
 *
 * Por quê: o disco da VPS é a mesma máquina que roda o app. Se ela for
 * perdida, o backup vai junto. O Storage do Supabase é outro lugar; e mesmo
 * sendo o mesmo fornecedor do banco, um `delete` por engano numa tabela não
 * apaga um arquivo num bucket.
 *
 * Nunca derruba o backup: se a nuvem falhar, o arquivo local já está salvo e
 * o motivo vai no resultado, para o log do cron.
 */
async function subirParaNuvem(
  sb: SupabaseClient,
  arquivos: string[],
  dia: string,
): Promise<ResultadoBackup["nuvem"]> {
  const enviados: string[] = [];
  const apagados: string[] = [];
  try {
    for (const caminho of arquivos) {
      const nome = path.basename(caminho);
      const { error } = await sb.storage
        .from(BUCKET_NUVEM)
        .upload(nome, fs.readFileSync(caminho), { contentType: "application/gzip", upsert: true });
      if (error) throw new Error(`${nome}: ${error.message}`);
      enviados.push(nome);
    }

    const { data: lista, error: erroLista } = await sb.storage.from(BUCKET_NUVEM).list("", { limit: 1000 });
    if (erroLista) throw new Error(`listar: ${erroLista.message}`);
    const nomes = (lista ?? []).map((o) => o.name);
    const dias = nomes.map((n) => diaDoArquivo(n) ?? diaDasSessoes(n)).filter((d): d is string => d !== null);
    const remover = decidirRemocoes(dias, dia).flatMap((d) => {
      const n = nomesDoDia(d);
      return [n.dados, n.sessoes].filter((x) => nomes.includes(x));
    });
    if (remover.length > 0) {
      const { error } = await sb.storage.from(BUCKET_NUVEM).remove(remover);
      if (error) throw new Error(`apagar antigos: ${error.message}`);
      apagados.push(...remover);
    }
    return { enviados, apagados, erro: null };
  } catch (e) {
    return { enviados, apagados, erro: e instanceof Error ? e.message : String(e) };
  }
}

export async function executarBackup(
  sb: SupabaseClient,
  pasta = PASTA_PADRAO,
  quando = new Date(),
  /*
   * turbopackIgnore é obrigatório aqui. Sem ele o Turbopack trata o caminho
   * como padrão de arquivos e tenta mapear a pasta de sessões inteira
   * (67 mil arquivos) dentro do build — foi o que estourou a memória da VPS
   * em 20/10 e derrubou o deploy. O live-manager tem a mesma marcação.
   */
  pastaSessoes = path.join(/*turbopackIgnore: true*/ process.cwd(), ".whatsapp-sessions"),
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

  const { esquema, migracoes, aviso: avisoEsquema } = await lerEsquema(sb);

  fs.mkdirSync(pasta, { recursive: true });
  const nomes = nomesDoDia(dia);
  const arquivo = path.join(pasta, nomes.dados);
  const corpo = JSON.stringify({
    gerado_em: new Date().toISOString(),
    dia,
    versao: 2,
    esquema_sql: esquema,
    migracoes,
    aviso_esquema: avisoEsquema,
    tabelas: conteudo,
  });
  /*
   * Grava em temporário e renomeia. Se a VPS cair no meio da escrita, não
   * sobra um .gz truncado com cara de backup bom.
   */
  const temporario = `${arquivo}.tmp`;
  fs.writeFileSync(temporario, zlib.gzipSync(Buffer.from(corpo, "utf8")));
  fs.renameSync(temporario, arquivo);
  const bytes = fs.statSync(arquivo).size;

  const sessoes = empacotarSessoes(pastaSessoes, path.join(pasta, nomes.sessoes));

  const existentes = fs
    .readdirSync(pasta)
    .map((n) => diaDoArquivo(n) ?? diaDasSessoes(n))
    .filter((d): d is string => d !== null);
  const apagados: string[] = [];
  for (const d of decidirRemocoes(existentes, dia)) {
    const n = nomesDoDia(d);
    for (const nome of [n.dados, n.sessoes]) {
      try {
        fs.unlinkSync(path.join(pasta, nome));
        if (!apagados.includes(d)) apagados.push(d);
      } catch {
        /* já não estava lá */
      }
    }
  }

  const nuvem = await subirParaNuvem(sb, [arquivo, ...(sessoes ? [sessoes] : [])], dia);

  return {
    arquivo,
    bytes,
    tabelas: tabelas.length,
    linhas,
    apagados,
    esquemaBytes: esquema.length,
    migracoes: migracoes.length,
    sessoes,
    nuvem,
  };
}
