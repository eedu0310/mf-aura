/**
 * GUARDIÃO DO CONHECIMENTO — a base de conhecimento da AURA não se perde.
 *
 * Três camadas protegem o que a AURA sabe (docs/agentes.md):
 *
 *   1. o HISTÓRICO (aura_conhecimento_historico, migração 108): cada inclusão,
 *      alteração e exclusão vira uma linha que ninguém apaga;
 *   2. esta CÓPIA NOTURNA, só do conhecimento, às 23h30: um arquivo por dia
 *      no bucket "backups", em conhecimento/AAAA-MM-DD.json.gz, guardado por
 *      um ano (o backup do banco inteiro guarda só ~30 dias);
 *   3. o BACKUP COMPLETO das 22h (src/lib/backup/executar.ts).
 *
 * Toda noite o Guardião: lê todas as tabelas de conhecimento (inteiras, em
 * páginas — sem o corte de mil linhas do PostgREST), grava o .json.gz,
 * BAIXA o arquivo de volta e confere linha a linha a contagem (arquivo que
 * só parece existir é pior que nenhum), apaga as cópias com mais de 365 dias
 * e compara com a noite anterior: se alguma tabela encolheu mais de 5%, é
 * sinal de exclusão por engano — avisa a Diretora e põe um item urgente no
 * Meu Dia dos gestores mestres, com o caminho da cópia de ontem.
 *
 * Não usa IA.
 */
import zlib from "node:zlib";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET_NUVEM } from "@/lib/backup/executar";
import { inicioDoDiaEmSaoPaulo } from "@/lib/fuso";
import { equipeAtiva, mestres } from "./pessoas";
import { faltaNoBanco } from "./util";
import type { Achado, ContextoAgente, DefinicaoAgente, MensagemEscritorio, ResultadoAgente } from "./tipos";

export const ID_GUARDIAO = "guardiao";
export const PASTA_CONHECIMENTO = "conhecimento";
export const DIAS_GUARDADOS = 365;
export const QUEDA_QUE_ALERTA = 0.05;

const PAGINA = 1000;
const DIA = 86_400_000;

/** As tabelas da base de conhecimento e a coluna que ordena a paginação. */
export const TABELAS_DO_CONHECIMENTO: Array<{ nome: string; ordem: string; tirar?: string[] }> = [
  { nome: "aura_aprendizado", ordem: "id" },
  { nome: "aura_aprendizado_origem", ordem: "id" },
  { nome: "aura_materiais", ordem: "id" },
  // `busca` é o índice de texto, refeito sozinho a partir do texto.
  { nome: "aura_material_trechos", ordem: "id", tirar: ["busca"] },
  { nome: "playbook", ordem: "empresa" },
  { nome: "perguntas_frequentes", ordem: "id" },
  { nome: "treinamentos", ordem: "id" },
  { nome: "links_uteis", ordem: "id" },
  { nome: "perguntas_qualificacao", ordem: "id" },
  // A própria equipe também é conhecimento: os agentes criados e as propostas.
  { nome: "aura_agentes", ordem: "id" },
  { nome: "aura_agente_propostas", ordem: "id" },
];

export function caminhoDoDia(dia: string): string {
  return `${PASTA_CONHECIMENTO}/${dia}.json.gz`;
}

export function diaDoCaminho(nome: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})\.json\.gz$/.exec(nome);
  return m ? m[1] : null;
}

/** Os dias que passaram do prazo de guarda (nunca o de hoje). */
export function diasParaApagar(dias: string[], hoje: string, guardar = DIAS_GUARDADOS): string[] {
  const limite = new Date(new Date(`${hoje}T12:00:00-03:00`).getTime() - guardar * DIA)
    .toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return dias.filter((d) => d !== hoje && d < limite);
}

/** As tabelas que encolheram mais que o limite em relação à noite anterior. */
export function quedasDeConhecimento(
  antes: Record<string, number>,
  depois: Record<string, number>,
  limite = QUEDA_QUE_ALERTA,
): Array<{ tabela: string; antes: number; depois: number; queda: number }> {
  const saida: Array<{ tabela: string; antes: number; depois: number; queda: number }> = [];
  for (const { nome } of TABELAS_DO_CONHECIMENTO) {
    const a = Number(antes[nome]);
    const d = Number(depois[nome]);
    if (!Number.isFinite(a) || !Number.isFinite(d) || a <= 0 || d < 0) continue;
    const queda = (a - d) / a;
    if (queda > limite) saida.push({ tabela: nome, antes: a, depois: d, queda });
  }
  return saida;
}

async function lerTabelaInteira(
  sb: SupabaseClient,
  tabela: { nome: string; ordem: string; tirar?: string[] },
): Promise<Record<string, unknown>[] | null> {
  const todas: Record<string, unknown>[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await sb
      .from(tabela.nome)
      .select("*")
      .order(tabela.ordem, { ascending: true })
      .range(de, de + PAGINA - 1);
    if (error) {
      if (de === 0 && faltaNoBanco(error)) return null; // tabela não existe neste banco
      throw new Error(`${tabela.nome}: ${error.message}`);
    }
    const lote = (data ?? []) as Record<string, unknown>[];
    for (const linha of lote) for (const c of tabela.tirar ?? []) delete linha[c];
    todas.push(...lote);
    if (lote.length < PAGINA) break;
  }
  return todas;
}

async function listarCopias(sb: SupabaseClient): Promise<string[]> {
  const nomes: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb.storage.from(BUCKET_NUVEM).list(PASTA_CONHECIMENTO, { limit: 1000, offset });
    if (error) throw new Error(`listar cópias: ${error.message}`);
    const lote = data ?? [];
    nomes.push(...lote.map((o) => o.name));
    if (lote.length < 1000) break;
  }
  return nomes;
}

async function executarGuardiao(ctx: ContextoAgente): Promise<ResultadoAgente> {
  const { sb, agora, hoje } = ctx;

  // ---------- 1. ler tudo ----------
  const tabelas: Record<string, Record<string, unknown>[]> = {};
  const contagens: Record<string, number> = {};
  const ausentes: string[] = [];
  for (const t of TABELAS_DO_CONHECIMENTO) {
    // Falha de leitura derruba a rodada: um arquivo com metade da base e nome
    // de cópia boa daria a falsa sensação de que o conhecimento está salvo.
    const linhas = await lerTabelaInteira(sb, t);
    if (linhas === null) {
      ausentes.push(t.nome);
      continue;
    }
    tabelas[t.nome] = linhas;
    contagens[t.nome] = linhas.length;
  }
  const totalLinhas = Object.values(contagens).reduce((s, n) => s + n, 0);

  // ---------- 2. gravar ----------
  const corpo = Buffer.from(
    JSON.stringify({ gerado_em: new Date().toISOString(), dia: hoje, versao: 1, contagens, ausentes, tabelas }),
    "utf8",
  );
  const gz = zlib.gzipSync(corpo);
  const caminho = caminhoDoDia(hoje);
  const { error: erroUpload } = await sb.storage
    .from(BUCKET_NUVEM)
    .upload(caminho, gz, { contentType: "application/gzip", upsert: true });
  if (erroUpload) throw new Error(`Não consegui subir ${caminho}: ${erroUpload.message}`);

  // ---------- 3. conferir o que subiu ----------
  const { data: baixado, error: erroDownload } = await sb.storage.from(BUCKET_NUVEM).download(caminho);
  if (erroDownload || !baixado) throw new Error(`Subi ${caminho}, mas não consegui baixar de volta: ${erroDownload?.message ?? "vazio"}`);
  const conferido = JSON.parse(zlib.gunzipSync(Buffer.from(await baixado.arrayBuffer())).toString("utf8")) as {
    tabelas?: Record<string, unknown[]>;
  };
  const divergentes = Object.entries(contagens).filter(
    ([nome, n]) => (conferido.tabelas?.[nome]?.length ?? -1) !== n,
  );
  if (divergentes.length) {
    throw new Error(`A cópia na nuvem não bate com o banco em: ${divergentes.map(([n]) => n).join(", ")}`);
  }

  // ---------- 4. guardar um ano ----------
  let apagados = 0;
  try {
    const nomes = await listarCopias(sb);
    const dias = nomes.map(diaDoCaminho).filter((d): d is string => d !== null);
    const remover = diasParaApagar(dias, hoje).map(caminhoDoDia);
    if (remover.length) {
      const { error } = await sb.storage.from(BUCKET_NUVEM).remove(remover);
      if (error) ctx.log("não consegui apagar cópias antigas:", error.message);
      else apagados = remover.length;
    }
  } catch (e) {
    ctx.log("retenção:", e instanceof Error ? e.message : String(e));
  }

  // ---------- 5. comparar com a noite anterior ----------
  const { data: anterior } = await sb
    .from("aura_agente_execucoes")
    .select("metricas, inicio")
    .eq("agente_id", ID_GUARDIAO)
    .eq("status", "ok")
    .lt("inicio", inicioDoDiaEmSaoPaulo(agora))
    .order("inicio", { ascending: false })
    .limit(1)
    .maybeSingle();
  const antes = (anterior?.metricas ?? {}) as Record<string, number>;
  const quedas = quedasDeConhecimento(antes, contagens);

  const mensagens: MensagemEscritorio[] = [];
  const ontem = new Date(new Date(`${hoje}T12:00:00-03:00`).getTime() - DIA).toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
  if (quedas.length) {
    const texto = quedas
      .map((q) => `${q.tabela}: de ${q.antes} para ${q.depois} (−${Math.round(q.queda * 100)}%)`)
      .join("; ");
    mensagens.push({
      de: ID_GUARDIAO,
      tipo: "alerta",
      texto: `A base de conhecimento encolheu desde ontem: ${texto}. Pode ser exclusão por engano. A cópia de ontem está em ${caminhoDoDia(ontem)} e cada versão apagada está no histórico.`,
      dados: { chave: `queda:${hoje}`, dia: hoje, quedas },
    });
  }

  // O alerta vira item urgente para os gestores mestres e continua aparecendo
  // por 7 dias (re-relatado a cada noite), para não "se resolver sozinho" na
  // rodada seguinte só porque a contagem parou de cair.
  const achados: Achado[] = [];
  const { data: alertasRecentes } = await sb
    .from("aura_escritorio_mensagens")
    .select("texto, dados, criado_em")
    .eq("de_agente", ID_GUARDIAO)
    .eq("tipo", "alerta")
    .gte("criado_em", new Date(agora.getTime() - 7 * DIA).toISOString());
  const alertas = [
    ...(alertasRecentes ?? []).map((a) => ({ dia: String((a.dados as { dia?: string } | null)?.dia ?? ""), texto: String(a.texto) })),
    ...mensagens.map((m) => ({ dia: hoje, texto: m.texto })),
  ].filter((a) => a.dia);
  if (alertas.length) {
    const equipe = await equipeAtiva(sb);
    const vistos = new Set<string>();
    for (const a of alertas) {
      if (vistos.has(a.dia)) continue;
      vistos.add(a.dia);
      for (const m of mestres(equipe)) {
        achados.push({
          chave: `conhecimento:queda:${a.dia}:${m.id}`,
          empresa: m.empresa,
          destinatarioId: m.id,
          titulo: "A base de conhecimento encolheu: confira se foi de propósito",
          descricao: a.texto,
          prioridade: "urgente",
          entidadeTipo: "perfil",
          entidadeId: m.id,
          acaoUrl: "/gestor",
          expiraEmDias: 7,
        });
      }
    }
  }

  const { count: versoes } = await sb.from("aura_conhecimento_historico").select("id", { count: "exact", head: true });
  const kb = Math.round(gz.length / 1024);
  return {
    resumo: `Base de conhecimento copiada e conferida na nuvem: ${totalLinhas} registros em ${Object.keys(contagens).length} tabelas (${kb} KB)${quedas.length ? `; ${quedas.length} tabela(s) encolheram desde ontem` : ""}.`,
    achados,
    mensagens,
    metricas: {
      ...contagens,
      totalLinhas,
      bytes: gz.length,
      copiasApagadas: apagados,
      tabelasAusentes: ausentes.length,
      quedas: quedas.length,
      versoesNoHistorico: versoes ?? 0,
    },
  };
}

export const GUARDIAO: DefinicaoAgente = {
  id: ID_GUARDIAO,
  nome: "Guardião do Conhecimento",
  cargo: "Guarda da base de conhecimento",
  setor: "conhecimento",
  icone: "ShieldCheck",
  missao:
    "Toda noite copia a base de conhecimento inteira para a nuvem, confere a cópia, guarda um ano de versões e avisa se algo sumiu.",
  agenda: { tipo: "diario", horas: [23], minuto: 30 },
  usaIA: false,
  orcamentoMensalUsd: 0,
  tipo: "nativo",
  executar: executarGuardiao,
};
