/**
 * O MOTOR DA EQUIPE DE AGENTES.
 *
 * Cada agente (src/lib/agentes/nativos, a Diretora, o Guardião, os
 * configuráveis) só sabe OLHAR e DEVOLVER um ResultadoAgente. Tudo o que é
 * igual para todos mora aqui, uma vez só:
 *
 *   1. o registro: quem existe (código + banco), quem está ligado, com que
 *      orçamento e em que agenda;
 *   2. a IA com trava (podeChamarIA, orçamento do mês do agente, 60 s de
 *      prazo, no máximo 2 novas tentativas, custo anotado em ia_uso como
 *      "agente/<id>");
 *   3. o que fazer com o resultado:
 *        achados ..... viram recomendação (aura_recomendacoes) sem repetir:
 *                      a mesma chave atualiza a pendente em vez de criar outra;
 *                      a que o agente não relatou mais vira "resolvida_sozinha";
 *                      a que passou da validade vira "expirada";
 *        aviso ....... UM aviso-resumo por pessoa por dia no sino
 *                      ("AURA: 3 itens novos para você hoje"), nunca um por item;
 *        escritório .. as falas do agente;
 *        conhecimento  sugestões em aura_aprendizado como "sugerido";
 *        propostas ... agente novo esperando o gestor;
 *        diário ...... uma linha por rodada, com o custo real tirado de ia_uso.
 *
 * SEM A MIGRAÇÃO 110 o motor não lança erro: responde "aguardando migração
 * 110" e não grava nada. O cron fica verde e a tela mostra o aviso.
 *
 * O motor NUNCA escreve em dado de negócio (venda, cliente, etapa, dono) e
 * nunca manda mensagem para cliente — regras 1 e 2 do contrato (tipos.ts).
 */
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { todasAsLinhas } from "@/lib/supabase/todas-as-linhas";
import { podeChamarIA, registrarFalhaIA, registrarUsoIA } from "@/lib/aura/custo-ia";
import { modeloDeRaciocinio, modeloDeVolume } from "@/lib/aura/modelos";
import { diaEmSaoPaulo, inicioDoDiaEmSaoPaulo, inicioDoMesEmSaoPaulo } from "@/lib/fuso";
import { guardarAprendizado, type TipoAprendizado } from "@/lib/aura/aprendizado";
import { AGENTES_NATIVOS } from "./nativos";
import { DIRETORA } from "./diretora";
import { GUARDIAO } from "./guardiao";
import { AGENTES_DO_SISTEMA } from "./sistema";
import { configuracaoValida, executarConfiguravel } from "./configuravel";
import { agendaValida, escolherDevidos } from "./agenda";
import { ehUuid, faltaNoBanco, lerJsonDaIA, MOTIVO_SEM_108 } from "./util";
import type {
  Achado,
  ChamadaIA,
  ConfigAgenteConfiguravel,
  ContextoAgente,
  DefinicaoAgente,
  MensagemEscritorio,
  PropostaAgente,
  ResultadoAgente,
  Setor,
  SugestaoConhecimento,
} from "./tipos";

/** Reexportada: quem já importava do motor continua funcionando. */
export { agendaValida };

const MINUTO = 60_000;
const DIA = 86_400_000;

/** Rodada "rodando" há mais que isto morreu no meio (deploy, queda da VPS). */
const RODADA_MORTA_MS = 20 * MINUTO;
/** Prazo padrão de uma rodada, para um agente travado não segurar o cron. */
const PRAZO_PADRAO_MS = 200_000;

const SETORES: Setor[] = ["direcao", "vendas", "pos-venda", "marketing", "gestao", "conhecimento", "dados"];
const PRIORIDADES = new Set(["baixa", "media", "alta", "urgente"]);
const TIPOS_DE_FALA = new Set(["relato", "pedido", "resposta", "ideia", "alerta", "aprendizado", "plano"]);

/* ------------------------------------------------------------------ */
/* Registro                                                            */
/* ------------------------------------------------------------------ */

export interface AgenteRegistrado extends DefinicaoAgente {
  ativo: boolean;
  criadoPor: "sistema" | "diretora" | "agente" | "gestor";
  criadoEm: string | null;
  /** Só nos configuráveis. */
  config?: ConfigAgenteConfiguravel;
  /** Id da proposta de onde o agente nasceu (configuráveis). */
  propostaId?: string | null;
}

/** Os agentes escritos no código, sem repetir id (o primeiro vence). */
export function agentesDoCodigo(): DefinicaoAgente[] {
  const lista: DefinicaoAgente[] = [
    DIRETORA,
    GUARDIAO,
    ...((AGENTES_NATIVOS as DefinicaoAgente[] | undefined) ?? []),
    ...AGENTES_DO_SISTEMA,
  ];
  const vistos = new Set<string>();
  return lista.filter((a) => {
    if (!a?.id || vistos.has(a.id)) return false;
    vistos.add(a.id);
    return true;
  });
}

interface LinhaAgente {
  id: string;
  nome: string;
  cargo: string | null;
  setor: string | null;
  icone: string | null;
  missao: string | null;
  tipo: string;
  ativo: boolean;
  agenda: unknown;
  usa_ia: boolean | null;
  orcamento_mensal_usd: number | string | null;
  config: unknown;
  criado_por: string | null;
  proposta_id: string | null;
  criado_em: string | null;
}

const g = globalThis as unknown as { __aura108?: { ok: boolean; em: number } };

/**
 * A migração 110 está no banco? Confere as tabelas novas E uma coluna nova
 * de aura_recomendacoes (aplicação pela metade também é "não").
 * O "sim" fica guardado 5 minutos; o "não", 30 segundos.
 */
export async function temMigracao108(sb: SupabaseClient): Promise<boolean> {
  const c = g.__aura108;
  if (c && Date.now() - c.em < (c.ok ? 5 * MINUTO : 30_000)) return c.ok;
  const [a, b, d] = await Promise.all([
    sb.from("aura_agente_execucoes").select("id").limit(1),
    sb.from("aura_escritorio_mensagens").select("id").limit(1),
    sb.from("aura_recomendacoes").select("id, agente, chave, expira_em, acao_url").limit(1),
  ]);
  for (const r of [a, b, d]) {
    if (r.error && !faltaNoBanco(r.error)) throw new Error(`Não consegui conferir a migração 110: ${r.error.message}`);
  }
  const ok = !a.error && !b.error && !d.error;
  g.__aura108 = { ok, em: Date.now() };
  return ok;
}

/**
 * Todos os agentes: os do código com o que o banco sobrepõe (ligado,
 * orçamento, agenda) mais os configuráveis que só existem no banco.
 * Sem a 110, só o código (todos com o padrão do código).
 */
export async function carregarRegistro(sb: SupabaseClient, com108?: boolean): Promise<AgenteRegistrado[]> {
  const usar108 = com108 ?? (await temMigracao108(sb));
  let linhas: LinhaAgente[] = [];
  if (usar108) {
    const { data, error } = await sb.from("aura_agentes").select("*");
    if (error && !faltaNoBanco(error)) throw new Error(`Não consegui ler aura_agentes: ${error.message}`);
    linhas = (data ?? []) as LinhaAgente[];
  }
  const porId = new Map(linhas.map((l) => [l.id, l]));

  const saida: AgenteRegistrado[] = agentesDoCodigo().map((def) => {
    const l = porId.get(def.id);
    const orc = l?.orcamento_mensal_usd;
    return {
      ...def,
      // Rotina do sistema liga e desliga no crontab, não aqui.
      ativo: def.tipo === "sistema" ? true : l ? l.ativo !== false : true,
      orcamentoMensalUsd: orc !== null && orc !== undefined && Number.isFinite(Number(orc)) ? Number(orc) : def.orcamentoMensalUsd,
      agenda: agendaValida(l?.agenda) ?? def.agenda,
      criadoPor: "sistema",
      criadoEm: l?.criado_em ?? null,
    };
  });

  const doCodigo = new Set(saida.map((a) => a.id));
  for (const l of linhas) {
    if (doCodigo.has(l.id) || l.tipo !== "configuravel") continue;
    const config = configuracaoValida(l.config);
    const meta = { id: l.id, nome: l.nome };
    const setor = SETORES.includes(l.setor as Setor) ? (l.setor as Setor) : "gestao";
    saida.push({
      id: l.id,
      nome: l.nome,
      cargo: l.cargo || "Agente criado pela equipe",
      setor,
      icone: l.icone || "Bot",
      missao: l.missao ?? "",
      agenda: config?.agenda ?? agendaValida(l.agenda) ?? { tipo: "diario", horas: [8] },
      usaIA: true,
      orcamentoMensalUsd: Number(l.orcamento_mensal_usd ?? 0) || 0,
      tipo: "configuravel",
      // Configuração quebrada não roda: o agente aparece desligado.
      executar: config ? (ctx) => executarConfiguravel(ctx, config, meta) : undefined,
      ativo: l.ativo !== false && !!config,
      criadoPor: (["sistema", "diretora", "agente", "gestor"].includes(l.criado_por ?? "")
        ? l.criado_por
        : "gestor") as AgenteRegistrado["criadoPor"],
      criadoEm: l.criado_em,
      config: config ?? undefined,
      propostaId: l.proposta_id,
    });
  }
  return saida;
}

/* ------------------------------------------------------------------ */
/* IA com trava                                                        */
/* ------------------------------------------------------------------ */

let cliente: Anthropic | null = null;
let clienteChave = "";
function clienteIA(): Anthropic | null {
  const chave = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || "";
  if (!chave) return null;
  if (!cliente || clienteChave !== chave) {
    // 60 s de prazo e no máximo 2 novas tentativas (o SDK repete 429/5xx).
    cliente = new Anthropic({ apiKey: chave, timeout: 60_000, maxRetries: 2 });
    clienteChave = chave;
  }
  return cliente;
}

/**
 * Uma chamada de IA, já com saldo, custo e falha anotados. Devolve null em
 * vez de lançar: quem chama segue só com regras.
 * Usada pelo contexto dos agentes e pela rota "Gerar mensagem".
 */
export async function chamarIA(
  ch: ChamadaIA & { funcao: string; empresa?: string | null; usuarioId?: string | null },
): Promise<string | Record<string, unknown> | null> {
  const client = clienteIA();
  if (!client) return null;
  if (!(await podeChamarIA())) return null;
  const modelo = ch.perfil === "redacao" ? modeloDeRaciocinio() : modeloDeVolume();
  const sistema = ch.json
    ? `${ch.sistema}\n\nResponda SOMENTE com um objeto JSON válido, sem texto antes ou depois e sem cercas de código.`
    : ch.sistema;
  try {
    const resp = await client.messages.create({
      model: modelo,
      max_tokens: ch.maxTokens ?? 1500,
      system: sistema,
      messages: [{ role: "user", content: ch.usuario }],
    });
    await registrarUsoIA({
      funcao: ch.funcao,
      modelo,
      uso: resp.usage,
      empresa: ch.empresa ?? null,
      usuarioId: ch.usuarioId ?? null,
    });
    if ((resp.stop_reason as string) === "refusal") return null;
    const texto = resp.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    if (!ch.json) return texto || null;
    return lerJsonDaIA(texto);
  } catch (erro) {
    await registrarFalhaIA({ funcao: ch.funcao, erro, empresa: ch.empresa ?? null, usuarioId: ch.usuarioId ?? null });
    return null;
  }
}

/** Quanto o agente já gastou de IA neste mês (ia_uso, funcao = "agente/<id>"). */
export async function gastoDoMes(sb: SupabaseClient, agenteId: string, agora = new Date()): Promise<number> {
  const linhas = await todasAsLinhas<{ custo_usd: number | string }>((de, ate) =>
    sb
      .from("ia_uso")
      .select("custo_usd")
      .eq("funcao", `agente/${agenteId}`)
      .gte("criado_em", inicioDoMesEmSaoPaulo(agora))
      .order("id")
      .range(de, ate),
  );
  return linhas.reduce((s, l) => s + Number(l.custo_usd ?? 0), 0);
}

async function custoDesde(sb: SupabaseClient, agenteId: string, desde: Date): Promise<number> {
  const { data } = await sb
    .from("ia_uso")
    .select("custo_usd")
    .eq("funcao", `agente/${agenteId}`)
    .gte("criado_em", desde.toISOString())
    .limit(1000);
  return Number((data ?? []).reduce((s, l) => s + Number(l.custo_usd ?? 0), 0).toFixed(6));
}

interface EstadoIA {
  chamadas: number;
  falhas: number;
  bloqueadas: number;
}

function criarIA(sb: SupabaseClient, def: AgenteRegistrado, agora: Date, estado: EstadoIA, log: (...p: unknown[]) => void) {
  return async (ch: ChamadaIA) => {
    estado.chamadas += 1;
    if (!def.usaIA) {
      estado.bloqueadas += 1;
      log("este agente está marcado como sem IA; chamada recusada");
      return null;
    }
    if (!(await podeChamarIA())) {
      estado.bloqueadas += 1;
      log("saldo de IA bloqueado pelo gestor");
      return null;
    }
    const gasto = await gastoDoMes(sb, def.id, agora).catch(() => Number.POSITIVE_INFINITY);
    if (!(def.orcamentoMensalUsd > 0) || gasto >= def.orcamentoMensalUsd) {
      estado.bloqueadas += 1;
      log(`orçamento do mês esgotado (US$ ${gasto.toFixed(2)} de ${def.orcamentoMensalUsd})`);
      return null;
    }
    const r = await chamarIA({ ...ch, funcao: `agente/${def.id}` });
    if (r === null) estado.falhas += 1;
    return r;
  };
}

/* ------------------------------------------------------------------ */
/* Quem roda agora                                                     */
/* ------------------------------------------------------------------ */

async function ultimosInicios(sb: SupabaseClient, ids: string[]): Promise<Map<string, string | null>> {
  const mapa = new Map<string, string | null>();
  await Promise.all(
    ids.map(async (id) => {
      const { data } = await sb
        .from("aura_agente_execucoes")
        .select("inicio")
        .eq("agente_id", id)
        .order("inicio", { ascending: false })
        .limit(1)
        .maybeSingle();
      mapa.set(id, (data?.inicio as string | undefined) ?? null);
    }),
  );
  return mapa;
}

/** Os agentes ligados cuja agenda manda rodar agora (a Diretora por último). */
export async function agentesDevidos(
  agora: Date = new Date(),
  opcoes: { sb?: SupabaseClient; registro?: AgenteRegistrado[] } = {},
): Promise<AgenteRegistrado[]> {
  const sb = opcoes.sb ?? getSupabaseServiceClient();
  if (!sb) throw new Error("Supabase não configurado.");
  if (!(await temMigracao108(sb))) return [];
  const registro = opcoes.registro ?? (await carregarRegistro(sb, true));
  const candidatos = registro.filter((a) => a.ativo && typeof a.executar === "function");
  const ultimas = await ultimosInicios(sb, candidatos.map((a) => a.id));
  return escolherDevidos(candidatos, ultimas, agora);
}

/* ------------------------------------------------------------------ */
/* Rodar                                                               */
/* ------------------------------------------------------------------ */

export interface ResultadoRodada {
  agente: string;
  status: "ok" | "erro" | "ignorado" | "ocupado" | "aguardando_migracao";
  mensagem?: string;
  execucaoId?: string | null;
  resumo?: string;
  achados?: number;
  novos?: number;
  atualizados?: number;
  resolvidosSozinhos?: number;
  expirados?: number;
  avisados?: number;
  custoUsd?: number;
  duracaoMs?: number;
  erro?: string;
}

function comPrazo<T>(promessa: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<never>((_, rejeitar) => {
    timer = setTimeout(() => rejeitar(new Error(`passou do prazo de ${Math.round(ms / 1000)} s`)), ms);
  });
  return Promise.race([promessa, prazo]).finally(() => clearTimeout(timer));
}

/**
 * Roda UM agente agora. `forcar` roda mesmo desligado ou fora de hora
 * (botão "Rodar agora" do gestor mestre, ou ?agente=<id>&forcar=1 no cron).
 */
export async function rodarAgente(
  id: string,
  opcoes: { forcar?: boolean; sb?: SupabaseClient; agora?: Date; limiteMs?: number; registro?: AgenteRegistrado[] } = {},
): Promise<ResultadoRodada> {
  const sb = opcoes.sb ?? getSupabaseServiceClient();
  if (!sb) throw new Error("Supabase não configurado.");
  if (!(await temMigracao108(sb))) return { agente: id, status: "aguardando_migracao", mensagem: MOTIVO_SEM_108 };

  const registro = opcoes.registro ?? (await carregarRegistro(sb, true));
  const def = registro.find((a) => a.id === id);
  if (!def) return { agente: id, status: "erro", erro: "Agente desconhecido." };
  if (typeof def.executar !== "function") {
    return {
      agente: id,
      status: "ignorado",
      mensagem: def.tipo === "sistema" ? "Rotina do sistema: roda pelo próprio cron." : "Agente sem configuração válida.",
    };
  }
  if (!def.ativo && !opcoes.forcar) return { agente: id, status: "ignorado", mensagem: "Agente desligado." };

  const agora = opcoes.agora ?? new Date();

  // Trava: uma rodada por agente de cada vez. A "rodando" velha demais é de
  // um processo que morreu no meio — fica registrada como erro e libera.
  const { data: rodando } = await sb
    .from("aura_agente_execucoes")
    .select("id, inicio")
    .eq("agente_id", id)
    .eq("status", "rodando");
  for (const r of rodando ?? []) {
    if (new Date(r.inicio as string).getTime() < Date.now() - RODADA_MORTA_MS) {
      await sb
        .from("aura_agente_execucoes")
        .update({ status: "erro", fim: new Date().toISOString(), erro: "Interrompida: o processo parou no meio da rodada." })
        .eq("id", r.id);
    } else {
      return { agente: id, status: "ocupado", mensagem: "Já existe uma rodada deste agente em andamento." };
    }
  }

  const inicio = new Date();
  const { data: exec, error: erroExec } = await sb
    .from("aura_agente_execucoes")
    .insert({ agente_id: id, inicio: inicio.toISOString(), status: "rodando" })
    .select("id")
    .single();
  if (erroExec) throw new Error(`Não consegui abrir a rodada de ${id}: ${erroExec.message}`);
  const execucaoId = exec.id as string;

  const linhasDeLog: string[] = [];
  const log = (...partes: unknown[]) => {
    const linha = partes.map((p) => (typeof p === "string" ? p : JSON.stringify(p))).join(" ");
    linhasDeLog.push(linha);
    console.log(`[agente/${id}]`, linha);
  };
  const estadoIA: EstadoIA = { chamadas: 0, falhas: 0, bloqueadas: 0 };
  const lidas: string[] = [];

  const ctx: ContextoAgente = {
    sb,
    agora,
    hoje: diaEmSaoPaulo(agora),
    agente: id,
    ia: criarIA(sb, def, agora, estadoIA, log),
    caixaDeEntrada: async () => {
      let consulta = sb
        .from("aura_escritorio_mensagens")
        .select("id, de_agente, para_agente, tipo, texto, empresa, dados, criado_em")
        .eq("lida_por_agente", false)
        .gte("criado_em", new Date(agora.getTime() - 7 * DIA).toISOString())
        .neq("de_agente", id)
        .order("criado_em", { ascending: true })
        .limit(50);
      // "Sem destinatário" é para a Diretora (contrato).
      consulta = id === DIRETORA.id ? consulta.or(`para_agente.is.null,para_agente.eq.${id}`) : consulta.eq("para_agente", id);
      const { data, error } = await consulta;
      if (error) {
        log("caixa de entrada indisponível:", error.message);
        return [];
      }
      for (const m of data ?? []) lidas.push(m.id as string);
      return (data ?? []).map((m) => ({
        id: m.id as string,
        criadoEm: m.criado_em as string,
        de: m.de_agente as string,
        para: (m.para_agente as string | null) ?? undefined,
        tipo: m.tipo as MensagemEscritorio["tipo"],
        texto: m.texto as string,
        empresa: (m.empresa as string | null) ?? undefined,
        dados: (m.dados as Record<string, unknown> | null) ?? undefined,
      }));
    },
    log,
  };

  let resultado: ResultadoAgente | null = null;
  let erro: string | null = null;
  try {
    resultado = await comPrazo(def.executar(ctx), opcoes.limiteMs ?? PRAZO_PADRAO_MS);
    if (!resultado || typeof resultado !== "object") throw new Error("O agente não devolveu resultado.");
  } catch (e) {
    erro = e instanceof Error ? e.message : String(e);
    log("falhou:", erro);
  }

  const contagem = {
    novos: 0,
    atualizados: 0,
    resolvidosSozinhos: 0,
    expirados: 0,
    descartados: 0,
    respeitados: 0,
    avisados: 0,
    mensagens: 0,
    aprendizados: 0,
    propostas: 0,
  };

  if (resultado && !erro) {
    try {
      // Se alguma chamada de IA falhou ou foi barrada, a rodada pode ter
      // relatado MENOS do que existe: não dá para concluir que o problema
      // sumiu. Nesse caso não marca nada como "resolvida sozinha".
      const podeResolver = estadoIA.falhas === 0 && estadoIA.bloqueadas === 0;
      const r = await gravarAchados(sb, def, resultado.achados ?? [], agora, podeResolver);
      Object.assign(contagem, r.contagem);
      contagem.avisados = await avisarPessoas(sb, [...r.novosPorPessoa.keys()], agora);
      contagem.mensagens = await gravarMensagens(sb, def, resultado.mensagens ?? []);
      contagem.aprendizados = await gravarAprendizados(sb, def, resultado.aprendizados ?? []);
      contagem.propostas = await gravarPropostas(sb, def, resultado.propostas ?? [], registro);
      if (lidas.length) {
        await sb.from("aura_escritorio_mensagens").update({ lida_por_agente: true }).in("id", lidas);
      }
    } catch (e) {
      erro = `Rodou, mas não consegui gravar o resultado: ${e instanceof Error ? e.message : String(e)}`;
      log(erro);
    }
  }

  const custoUsd = await custoDesde(sb, id, inicio).catch(() => 0);
  const resumo = erro ? `Falhou: ${erro}` : (resultado?.resumo ?? "").trim() || "Rodada sem novidades.";
  const metricas: Record<string, number> = {
    ...(resultado?.metricas ?? {}),
    ...contagem,
    iaChamadas: estadoIA.chamadas,
    iaFalhas: estadoIA.falhas,
    iaBarradas: estadoIA.bloqueadas,
  };
  await sb
    .from("aura_agente_execucoes")
    .update({
      fim: new Date().toISOString(),
      status: erro ? "erro" : "ok",
      resumo,
      achados: resultado?.achados?.length ?? 0,
      metricas,
      custo_usd: custoUsd,
      erro: erro ? `${erro}${linhasDeLog.length ? `\n\n${linhasDeLog.slice(-20).join("\n")}` : ""}` : null,
    })
    .eq("id", execucaoId);

  await relatarNoEscritorio(sb, def, { erro, resumo, novos: contagem.novos, resolvidos: contagem.resolvidosSozinhos }).catch(
    (e) => console.error(`[agente/${id}] relato:`, e),
  );

  return {
    agente: id,
    status: erro ? "erro" : "ok",
    execucaoId,
    resumo,
    achados: resultado?.achados?.length ?? 0,
    novos: contagem.novos,
    atualizados: contagem.atualizados,
    resolvidosSozinhos: contagem.resolvidosSozinhos,
    expirados: contagem.expirados,
    avisados: contagem.avisados,
    custoUsd,
    duracaoMs: Date.now() - inicio.getTime(),
    ...(erro ? { erro } : {}),
  };
}

/**
 * O que o cron chama a cada 10 minutos: roda, um de cada vez, os agentes
 * devidos, sem passar de `limiteMs` (o cron corta em 300 s; sobra folga).
 * Quem não coube fica para a próxima volta — continua devido.
 */
export async function rodarDevidos(opcoes: { limiteMs?: number; agora?: Date } = {}) {
  const sb = getSupabaseServiceClient();
  if (!sb) throw new Error("Supabase não configurado.");
  if (!(await temMigracao108(sb))) {
    return { situacao: "aguardando_migracao", motivo: MOTIVO_SEM_108, rodadas: [] as ResultadoRodada[], adiados: [] as string[] };
  }
  const comeco = Date.now();
  const limite = opcoes.limiteMs ?? 240_000;
  const registro = await carregarRegistro(sb, true);
  const devidos = await agentesDevidos(opcoes.agora ?? new Date(), { sb, registro });

  const rodadas: ResultadoRodada[] = [];
  const adiados: string[] = [];
  for (const a of devidos) {
    const resta = limite - (Date.now() - comeco);
    if (resta < 30_000) {
      adiados.push(a.id);
      continue;
    }
    try {
      rodadas.push(await rodarAgente(a.id, { sb, registro, limiteMs: Math.min(PRAZO_PADRAO_MS, resta - 10_000) }));
    } catch (e) {
      rodadas.push({ agente: a.id, status: "erro", erro: e instanceof Error ? e.message : String(e) });
    }
  }
  return { situacao: "ok", devidos: devidos.map((a) => a.id), rodadas, adiados };
}

/* ------------------------------------------------------------------ */
/* Gravação do resultado                                               */
/* ------------------------------------------------------------------ */

interface LinhaRecomendacao {
  id: string;
  chave: string;
  vendedor_id: string;
  titulo: string;
  descricao: string;
  prioridade: string;
  expira_em: string | null;
  acao_url: string | null;
}

async function emLotes<T>(itens: T[], tamanho: number, fazer: (lote: T[]) => Promise<void>) {
  for (let i = 0; i < itens.length; i += tamanho) await fazer(itens.slice(i, i + tamanho));
}

/**
 * Achados → aura_recomendacoes, sem repetir.
 *
 *  - mesma chave pendente: atualiza texto, prioridade, destinatário e link
 *    (só se mudou). A validade NÃO é empurrada para frente: o contrato diz
 *    que o item some depois do prazo e VOLTA se o problema continuar — só
 *    encurta, se o agente pedir prazo menor;
 *  - chave nova: cria — menos se a pessoa concluiu ou dispensou o mesmo
 *    item há menos que o prazo dele (dispensar não pode virar "volta amanhã");
 *  - pendente que o agente não relatou mais: "resolvida_sozinha";
 *  - pendente vencida (de qualquer agente): "expirada".
 */
export async function gravarAchados(
  sb: SupabaseClient,
  def: { id: string },
  achados: Achado[],
  agora: Date,
  podeResolver: boolean,
): Promise<{
  contagem: { novos: number; atualizados: number; resolvidosSozinhos: number; expirados: number; descartados: number; respeitados: number };
  novosPorPessoa: Map<string, number>;
}> {
  const contagem = { novos: 0, atualizados: 0, resolvidosSozinhos: 0, expirados: 0, descartados: 0, respeitados: 0 };
  const novosPorPessoa = new Map<string, number>();

  const validos = new Map<string, Achado>();
  for (const a of Array.isArray(achados) ? achados : []) {
    if (!a || typeof a.chave !== "string" || !a.chave.trim() || !ehUuid(a.destinatarioId) || !a.empresa || !a.titulo) {
      contagem.descartados += 1;
      continue;
    }
    validos.set(a.chave, a);
  }

  const abertos = await todasAsLinhas<LinhaRecomendacao>((de, ate) =>
    sb
      .from("aura_recomendacoes")
      .select("id, chave, vendedor_id, titulo, descricao, prioridade, expira_em, acao_url")
      .eq("agente", def.id)
      .eq("status", "pendente")
      .order("id")
      .range(de, ate),
  );
  const porChave = new Map(abertos.map((r) => [r.chave, r]));

  const fechados = await todasAsLinhas<{ chave: string; atualizado_em: string }>((de, ate) =>
    sb
      .from("aura_recomendacoes")
      .select("chave, atualizado_em")
      .eq("agente", def.id)
      .in("status", ["concluida", "dispensada"])
      .gte("atualizado_em", new Date(agora.getTime() - 60 * DIA).toISOString())
      .order("id")
      .range(de, ate),
  );
  const fechadoEm = new Map<string, number>();
  for (const f of fechados) {
    const t = new Date(f.atualizado_em).getTime();
    if (t > (fechadoEm.get(f.chave) ?? 0)) fechadoEm.set(f.chave, t);
  }

  const inserir: Record<string, unknown>[] = [];
  for (const a of validos.values()) {
    const dias = Math.max(1, Number(a.expiraEmDias) || 7);
    const expira = new Date(agora.getTime() + dias * DIA);
    const prioridade = PRIORIDADES.has(a.prioridade) ? a.prioridade : "media";
    const atual = porChave.get(a.chave);
    if (atual) {
      const mudou: Record<string, unknown> = {};
      if (atual.titulo !== a.titulo) mudou.titulo = a.titulo;
      if (atual.descricao !== (a.descricao ?? "")) mudou.descricao = a.descricao ?? "";
      if (atual.prioridade !== prioridade) mudou.prioridade = prioridade;
      if (atual.vendedor_id !== a.destinatarioId) mudou.vendedor_id = a.destinatarioId;
      if ((atual.acao_url ?? null) !== (a.acaoUrl ?? null)) mudou.acao_url = a.acaoUrl ?? null;
      if (!atual.expira_em || new Date(atual.expira_em).getTime() > expira.getTime()) mudou.expira_em = expira.toISOString();
      if (Object.keys(mudou).length) {
        const { error } = await sb.from("aura_recomendacoes").update(mudou).eq("id", atual.id);
        if (error) throw new Error(`atualizar recomendação: ${error.message}`);
        contagem.atualizados += 1;
      }
      continue;
    }
    const fechou = fechadoEm.get(a.chave);
    if (fechou && agora.getTime() - fechou < dias * DIA) {
      contagem.respeitados += 1;
      continue;
    }
    inserir.push({
      supervisao_id: null,
      agente: def.id,
      chave: a.chave,
      vendedor_id: a.destinatarioId,
      empresa: a.empresa,
      titulo: a.titulo,
      descricao: a.descricao ?? "",
      prioridade,
      origem: "agente",
      status: "pendente",
      entidade_tipo: a.entidadeTipo ?? null,
      entidade_id: ehUuid(a.entidadeId) ? a.entidadeId : null,
      prazo: diaEmSaoPaulo(agora),
      expira_em: expira.toISOString(),
      acao_url: a.acaoUrl ?? null,
      pode_gerar_mensagem: a.podeGerarMensagem === true,
    });
  }

  const contarNovo = (pessoa: string) => {
    contagem.novos += 1;
    novosPorPessoa.set(pessoa, (novosPorPessoa.get(pessoa) ?? 0) + 1);
  };
  await emLotes(inserir, 200, async (lote) => {
    const { error } = await sb.from("aura_recomendacoes").insert(lote);
    if (!error) {
      for (const l of lote) contarNovo(l.vendedor_id as string);
      return;
    }
    if (error.code !== "23505") throw new Error(`criar recomendações: ${error.message}`);
    // Outra rodada gravou a mesma chave no meio do caminho: um por um,
    // pulando o repetido.
    for (const l of lote) {
      const { error: e1 } = await sb.from("aura_recomendacoes").insert(l);
      if (!e1) contarNovo(l.vendedor_id as string);
      else if (e1.code !== "23505") throw new Error(`criar recomendação: ${e1.message}`);
    }
  });

  if (podeResolver) {
    const sumiram = abertos.filter((r) => !validos.has(r.chave)).map((r) => r.id);
    await emLotes(sumiram, 200, async (lote) => {
      const { error } = await sb
        .from("aura_recomendacoes")
        .update({ status: "resolvida_sozinha" })
        .in("id", lote)
        .eq("status", "pendente");
      if (error) throw new Error(`fechar resolvidas: ${error.message}`);
      contagem.resolvidosSozinhos += lote.length;
    });
  }

  const { data: vencidas, error: erroVencidas } = await sb
    .from("aura_recomendacoes")
    .update({ status: "expirada" })
    .not("agente", "is", null)
    .eq("status", "pendente")
    .lt("expira_em", agora.toISOString())
    .select("id");
  if (erroVencidas) throw new Error(`expirar vencidas: ${erroVencidas.message}`);
  contagem.expirados = vencidas?.length ?? 0;

  return { contagem, novosPorPessoa };
}

/**
 * UM aviso por pessoa por dia. O primeiro achado novo do dia cria o aviso;
 * os seguintes só trocam o número no mesmo aviso. Assim o sino toca uma vez,
 * e não a cada agente que rodou.
 */
async function avisarPessoas(sb: SupabaseClient, pessoas: string[], agora: Date): Promise<number> {
  if (!pessoas.length) return 0;
  const inicioDia = inicioDoDiaEmSaoPaulo(agora);
  // notificacoes.criada_em é "timestamp sem fuso" gravado em UTC: compara sem o Z.
  const inicioDiaSemFuso = inicioDia.replace(/Z$/, "");
  let avisados = 0;
  for (const pessoa of pessoas) {
    const { count } = await sb
      .from("aura_recomendacoes")
      .select("id", { count: "exact", head: true })
      .eq("vendedor_id", pessoa)
      .eq("status", "pendente")
      .not("agente", "is", null)
      .gte("criado_em", inicioDia);
    const n = count ?? 0;
    if (!n) continue;
    const titulo = `AURA: ${n} ${n === 1 ? "item novo" : "itens novos"} para você hoje`;
    const mensagem = "Os agentes da AURA separaram o que precisa da sua atenção. Está tudo no Meu Dia.";
    const { data: existente } = await sb
      .from("notificacoes")
      .select("id, titulo")
      .eq("vendedor_id", pessoa)
      .eq("tipo", "agentes")
      .gte("criada_em", inicioDiaSemFuso)
      .order("criada_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existente) {
      if (existente.titulo !== titulo) {
        await sb.from("notificacoes").update({ titulo, mensagem }).eq("id", existente.id);
      }
      continue;
    }
    const { error } = await sb
      .from("notificacoes")
      .insert({ vendedor_id: pessoa, titulo, mensagem, tipo: "agentes", acao_url: "/meu-dia" });
    if (error) console.error("[agentes] aviso:", error.message);
    else avisados += 1;
  }
  return avisados;
}

async function gravarMensagens(sb: SupabaseClient, def: { id: string }, mensagens: MensagemEscritorio[]): Promise<number> {
  const linhas = (Array.isArray(mensagens) ? mensagens : [])
    .filter((m) => m && typeof m.texto === "string" && m.texto.trim() && TIPOS_DE_FALA.has(m.tipo))
    .slice(0, 30)
    .map((m) => ({
      // Um agente só fala por si mesmo.
      de_agente: def.id,
      para_agente: m.para ?? null,
      tipo: m.tipo,
      texto: m.texto.trim(),
      empresa: m.empresa ?? null,
      dados: m.dados ?? {},
    }));
  if (!linhas.length) return 0;
  const { error } = await sb.from("aura_escritorio_mensagens").insert(linhas);
  if (error) throw new Error(`escritório: ${error.message}`);
  return linhas.length;
}

/** O tipo livre do contrato → os três tipos que aura_aprendizado aceita. */
export function tipoDoAprendizado(tipo: string): TipoAprendizado {
  const t = (tipo ?? "").toLowerCase();
  if (t.startsWith("objec") || t.startsWith("objeç")) return "objecao";
  if (t.startsWith("pergunta")) return "pergunta";
  return "abordagem";
}

async function gravarAprendizados(sb: SupabaseClient, def: { id: string }, lista: SugestaoConhecimento[]): Promise<number> {
  let novos = 0;
  // No máximo 10 por rodada: quem revisa é gente, e a fila tem limite humano.
  for (const s of (Array.isArray(lista) ? lista : []).slice(0, 10)) {
    if (!s?.empresa || !s.gatilho?.trim() || !s.resposta?.trim()) continue;
    const canal = ["whatsapp", "instagram", "manual"].includes(s.canal ?? "") ? (s.canal as string) : "whatsapp";
    try {
      const r = await guardarAprendizado(sb, {
        empresa: s.empresa,
        canal,
        tipo: tipoDoAprendizado(s.tipo),
        gatilho: s.gatilho.trim(),
        resposta: s.resposta.trim(),
        fonte: s.fonte?.trim() || `agente/${def.id}`,
      });
      if (r?.novo) novos += 1;
    } catch (e) {
      console.error(`[agente/${def.id}] aprendizado:`, e);
    }
  }
  return novos;
}

async function gravarPropostas(
  sb: SupabaseClient,
  def: { id: string },
  propostas: PropostaAgente[],
  registro: AgenteRegistrado[],
): Promise<number> {
  let gravadas = 0;
  for (const p of (Array.isArray(propostas) ? propostas : []).slice(0, 3)) {
    const nome = p?.nome?.trim();
    const config = configuracaoValida(p?.config);
    if (!nome || !config) continue;
    if (registro.some((a) => a.nome.trim().toLowerCase() === nome.toLowerCase())) continue;
    const { data: aberta } = await sb
      .from("aura_agente_propostas")
      .select("id")
      .ilike("nome", nome.replace(/[%_\\]/g, "\\$&"))
      .in("status", ["proposta", "aprovada"])
      .limit(1);
    if (aberta?.length) continue;
    const { error } = await sb.from("aura_agente_propostas").insert({
      proposto_por: def.id,
      nome,
      setor: SETORES.includes(p.setor) ? p.setor : "gestao",
      missao: p.missao ?? "",
      justificativa: p.justificativa ?? "",
      config,
      status: "proposta",
    });
    if (!error) gravadas += 1;
    else if (error.code !== "23505") throw new Error(`proposta: ${error.message}`);
  }
  return gravadas;
}

/**
 * O relato da rodada no escritório — só quando há novidade, e no máximo um
 * por hora por agente (falha sempre aparece). Sem isso, um agente de 10 em
 * 10 minutos enche o mural de "nada novo".
 */
async function relatarNoEscritorio(
  sb: SupabaseClient,
  def: AgenteRegistrado,
  r: { erro: string | null; resumo: string; novos: number; resolvidos: number },
) {
  if (def.id === DIRETORA.id) return; // ela publica o próprio plano
  if (!r.erro && r.novos === 0 && r.resolvidos === 0) return;
  if (!r.erro) {
    const { data } = await sb
      .from("aura_escritorio_mensagens")
      .select("id")
      .eq("de_agente", def.id)
      .eq("tipo", "relato")
      .gte("criado_em", new Date(Date.now() - 60 * MINUTO).toISOString())
      .limit(1);
    if (data?.length) return;
  }
  await sb.from("aura_escritorio_mensagens").insert({
    de_agente: def.id,
    para_agente: null,
    tipo: r.erro ? "alerta" : "relato",
    texto: r.erro ? `Não consegui terminar a rodada: ${r.erro}` : r.resumo,
    dados: { novos: r.novos, resolvidos: r.resolvidos },
  });
}

/** Nome de cada agente (código + banco), para as telas. */
export async function nomesDosAgentes(sb: SupabaseClient): Promise<Map<string, string>> {
  const mapa = new Map<string, string>(agentesDoCodigo().map((a) => [a.id, a.nome]));
  const { data, error } = await sb.from("aura_agentes").select("id, nome");
  if (!error) for (const l of data ?? []) mapa.set(l.id as string, l.nome as string);
  return mapa;
}
