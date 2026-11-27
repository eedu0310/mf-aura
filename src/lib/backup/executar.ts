import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { execFile } from "node:child_process";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Backup noturno do banco.
 *
 * ONDE E POR QUÊ: o banco vive no Supabase e a aplicação na VPS. Gravar o
 * arquivo no disco da VPS já coloca a cópia em outra casa — se o Supabase cair
 * ou alguém apagar dado por engano, o arquivo está em outro fornecedor.
 * Guardar dentro do próprio banco não seria backup. Desde 27/11/2026 vai também
 * para o Google Drive do dono, pelo rclone da VPS (enviarParaDrive): o
 * resultado aparece no log de toda noite ("drive: ok" ou o motivo), então se
 * a credencial vencer, aparece — em vez de falhar calado.
 */

export const PASTA_PADRAO = path.join(process.cwd(), ".backups");

/**
 * NA NUVEM (bucket "backups", fora da VPS): diários que ficam. Uma semana
 * cobre o "deu um problema ontem".
 */
export const DIARIOS_MANTIDOS = 7;
/** Domingos além disso, também na nuvem: o problema que só aparece dez dias depois. */
export const DOMINGOS_MANTIDOS = 4;

/*
 * NO DISCO DA VPS fica SÓ o backup do dia (pedido do Elton, 27/11/2026: "fez
 * o backup de hoje, exclui o de ontem e todos do passado"). O pacote das
 * sessões do WhatsApp tinha chegado a 6,4 GB por noite (levava junto a pasta
 * _media, o cache de fotos e áudios) e, com 7 diários + 4 domingos, ia ocupar
 * uns 70 GB do disco que o próprio AURA usa. O histórico de dias fica na
 * nuvem, que não ocupa a VPS.
 */

/**
 * Quais arquivos de backup apagar do disco: tudo que não é de hoje. O pacote
 * de sessões de um dia anterior só sai se o de hoje foi gerado (senão fica o
 * mais recente, para nunca ficar sem nenhum). Função pura: apagar backup não
 * perdoa engano.
 */
export function antigosNoDisco(nomes: string[], hoje: string, sessoesDeHojeOk: boolean): string[] {
  const apagar = nomes.filter((n) => {
    const d = diaDoArquivo(n);
    return d !== null && d !== hoje;
  });
  const sessoesVelhas = nomes
    .filter((n) => {
      const d = diaDasSessoes(n);
      return d !== null && d !== hoje;
    })
    .sort()
    .reverse();
  // Sem o pacote de hoje, o mais novo dos antigos fica.
  apagar.push(...(sessoesDeHojeOk ? sessoesVelhas : sessoesVelhas.slice(1)));
  return apagar;
}

/** Acima disto o arquivo nem é lido para subir (o Node não carrega mais de 2 GiB num Buffer). */
const MAIOR_ARQUIVO_NA_NUVEM = 1.5 * 1024 ** 3;

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
  /** Cópia no Google Drive do dono, pelo rclone: "ok: …", "não configurado (…)" ou "FALHOU: …". */
  drive: string;
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
  /**
   * Paginar SEM ordem não é confiável: o Postgres não garante a mesma ordem
   * entre um pedido e o seguinte, e uma linha gravada no meio do backup (o
   * WhatsApp e os crons escrevem o tempo todo) empurra as outras — a página
   * 2 repetia linhas da 1 e pulava outras. Ordena pelo id; a tabela que não
   * tiver coluna id cai na leitura sem ordem, como antes.
   */
  let ordenar = true;
  const todas: Record<string, unknown>[] = [];
  for (let de = 0; ; de += PAGINA) {
    let consulta = sb.from(tabela).select("*");
    if (ordenar) consulta = consulta.order("id", { ascending: true });
    const { data, error } = await consulta.range(de, de + PAGINA - 1);
    if (error) {
      // 42703 = coluna não existe. Só faz sentido trocar na primeira página.
      if (ordenar && de === 0 && (error as { code?: string }).code === "42703") {
        ordenar = false;
        de -= PAGINA;
        continue;
      }
      throw new Error(error.message);
    }
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
 * A pasta _media também (27/11/2026): é o cache das fotos, áudios e vídeos
 * das conversas — 6,4 GB que não religam sessão nenhuma e impediam o pacote
 * de subir para a nuvem. Sem ela o pacote tem o que importa: as credenciais
 * de cada aparelho e o _store das conversas.
 * Usa o `tar` do sistema; na VPS (Linux) ele sempre existe. Se não existir
 * (Windows de desenvolvimento), devolve null em vez de quebrar o backup.
 */
async function empacotarSessoes(pastaSessoes: string, destino: string): Promise<string | null> {
  if (!fs.existsSync(pastaSessoes)) return null;
  const temporario = `${destino}.tmp`;
  /*
   * Assíncrono (27/11/2026). Era spawnSync: enquanto o tar empacotava, o
   * Node inteiro ficava parado — o AURA não respondia ninguém. Com os 6,4 GB
   * da pasta _media isso levava minutos toda noite.
   */
  try {
    await rodar(
      "tar",
      ["-czf", temporario, "--exclude=diagnostico.log", "--exclude=_media", "-C", path.dirname(pastaSessoes), path.basename(pastaSessoes)],
      10 * 60_000,
    );
  } catch {
    try { fs.unlinkSync(temporario); } catch { /* não chegou a existir */ }
    return null;
  }
  fs.renameSync(temporario, destino);
  return destino;
}

/** Roda um programa sem travar o servidor; rejeita com o fim do stderr se falhar. */
function rodar(programa: string, args: string[], tempoMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(programa, args, { timeout: tempoMs, maxBuffer: 4 * 1024 * 1024 }, (erro, stdout, stderr) => {
      if (erro) reject(new Error((String(stderr || "").trim().split("\n").pop() || erro.message).slice(0, 300)));
      else resolve(String(stdout));
    });
  });
}

/* ------------------------------------------------------------ google drive */

/*
 * CÓPIA NO GOOGLE DRIVE DO DONO (pedido do Elton, 27/11/2026: "coloca o
 * backup diário no meu Google Drive, tenho 400 GB; já usei o rclone em outro
 * sistema e deu certo").
 *
 * Pelo rclone instalado na VPS, com um "remote" configurado pelo próprio
 * dono para o usuário do serviço (aura). O token do Google fica no
 * rclone.conf da VPS e nunca passa pelo código nem pelo banco. Sem o rclone
 * ou sem o remote, o backup segue normal e o log diz "drive: não
 * configurado" — não quebra nada.
 *
 * No Drive fica uma pasta por dia em "AURA Backups", e o que passa de
 * DIAS_NO_DRIVE dias é apagado de lá (só dentro dessa pasta).
 */
export const REMOTO_DRIVE = (process.env.AURA_RCLONE_REMOTO || "aura-drive").replace(/:$/, "");
export const PASTA_NO_DRIVE = "AURA Backups";
export const DIAS_NO_DRIVE = 30;

export async function enviarParaDrive(arquivos: string[], dia: string): Promise<string> {
  let remotos = "";
  try {
    remotos = await rodar("rclone", ["listremotes"], 20_000);
  } catch {
    return "não configurado (rclone não instalado na VPS)";
  }
  if (!remotos.split("\n").some((r) => r.trim() === `${REMOTO_DRIVE}:`)) {
    return `não configurado (falta o remote "${REMOTO_DRIVE}" no rclone)`;
  }
  const destino = `${REMOTO_DRIVE}:${PASTA_NO_DRIVE}/${dia}`;
  try {
    for (const a of arquivos) await rodar("rclone", ["copy", a, destino, "--retries", "3"], 10 * 60_000);
    // Limpeza só dentro de "AURA Backups": arquivos com mais de N dias e as pastas que ficarem vazias.
    await rodar("rclone", ["delete", `${REMOTO_DRIVE}:${PASTA_NO_DRIVE}`, "--min-age", `${DIAS_NO_DRIVE}d`], 5 * 60_000).catch(() => "");
    await rodar("rclone", ["rmdirs", `${REMOTO_DRIVE}:${PASTA_NO_DRIVE}`, "--leave-root"], 5 * 60_000).catch(() => "");
    return `ok: ${arquivos.map((a) => path.basename(a)).join(", ")} em ${PASTA_NO_DRIVE}/${dia}`;
  } catch (e) {
    return `FALHOU: ${e instanceof Error ? e.message : String(e)}`;
  }
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
  const falhas: string[] = [];
  /*
   * Cada arquivo sobe por conta própria: antes, o pacote de sessões grande
   * demais derrubava o envio inteiro e a limpeza dos antigos na nuvem nunca
   * rodava. Agora o banco sobe mesmo que as sessões falhem, e o motivo vai
   * para o log.
   */
  for (const caminho of arquivos) {
    const nome = path.basename(caminho);
    try {
      const tamanho = fs.statSync(caminho).size;
      if (tamanho > MAIOR_ARQUIVO_NA_NUVEM) {
        throw new Error(`grande demais para a nuvem (${(tamanho / 1024 ** 3).toFixed(1)} GB)`);
      }
      const { error } = await sb.storage
        .from(BUCKET_NUVEM)
        .upload(nome, fs.readFileSync(caminho), { contentType: "application/gzip", upsert: true });
      if (error) throw new Error(error.message);
      enviados.push(nome);
    } catch (e) {
      falhas.push(`${nome}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  try {

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
  } catch (e) {
    falhas.push(e instanceof Error ? e.message : String(e));
  }
  return { enviados, apagados, erro: falhas.length ? falhas.join(" | ") : null };
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

  const sessoes = await empacotarSessoes(pastaSessoes, path.join(pasta, nomes.sessoes));

  // No disco fica só o de hoje (ver antigosNoDisco). Só chega aqui com o
  // arquivo do banco de hoje já gravado e conferido pelo rename.
  const apagados: string[] = [];
  for (const nome of antigosNoDisco(fs.readdirSync(pasta), dia, sessoes !== null)) {
    try {
      fs.unlinkSync(path.join(pasta, nome));
      const d = diaDoArquivo(nome) ?? diaDasSessoes(nome);
      if (d && !apagados.includes(d)) apagados.push(d);
    } catch {
      /* já não estava lá */
    }
  }

  const doDia = [arquivo, ...(sessoes ? [sessoes] : [])];
  const [nuvem, drive] = await Promise.all([subirParaNuvem(sb, doDia, dia), enviarParaDrive(doDia, dia)]);

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
    drive,
  };
}
