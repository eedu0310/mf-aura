/**
 * AGENTES CONFIGURÁVEIS — os que a própria equipe cria.
 *
 * Um agente (quase sempre a Diretora) propõe; o gestor mestre aprova; nasce
 * uma linha em aura_agentes com uma ConfigAgenteConfiguravel. Este arquivo é
 * o motor genérico que dá vida a essa configuração, com as travas que um
 * agente escrito por IA precisa ter:
 *
 *   - lê SÓ a fonte que a configuração escolheu, de uma lista fechada;
 *   - de cada fonte lê SÓ colunas fixas e seguras — telefone, e-mail, JID do
 *     WhatsApp e texto livre de observação nunca chegam à IA;
 *   - no máximo `limitePorExecucao` achados (e nunca mais que 50);
 *   - a IA só ESCOLHE entre os itens que recebeu (id fora da lista é
 *     descartado) e escreve título e descrição;
 *   - o destinatário sai de regra, não da IA;
 *   - não escreve dado de negócio nenhum: só devolve achados para o motor.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { equipeAtiva, gestoresDaLoja, marketingDaLoja, posVendaDaLoja, type PessoaDaEquipe } from "./pessoas";
import { agendaValida } from "./agenda";
import type {
  Achado,
  ConfigAgenteConfiguravel,
  ContextoAgente,
  FonteConfiguravel,
  Prioridade,
  ResultadoAgente,
} from "./tipos";

const TETO_ACHADOS = 50;
/** Quantos itens da fonte vão para a IA escolher. Mantém o prompt pequeno. */
const ITENS_LIDOS = 150;
/** Texto longo (resumo de conversa) vai cortado só NO PROMPT, nunca no banco. */
const CARACTERES_POR_CAMPO = 300;

interface Fonte {
  tabela: string;
  colunas: string;
  /** Coluna de data para trazer os mais recentes. */
  ordem: string;
  /** Quem é o "dono" do item, na ordem de preferência. */
  donos: string[];
  /** Rótulo legível do item na tela. */
  rotulo: (l: Record<string, unknown>) => string;
  entidade: (l: Record<string, unknown>) => { tipo?: Achado["entidadeTipo"]; id?: string };
  acaoUrl: (l: Record<string, unknown>) => string | undefined;
  filtro?: (q: FiltroQuery) => FiltroQuery;
}

// Só os métodos de filtro que as fontes usam: evita brigar com os genéricos
// do cliente do Supabase sem perder a checagem de tipo do resto.
interface FiltroQuery {
  eq: (coluna: string, valor: unknown) => FiltroQuery;
}

const rel = (id: unknown) => (typeof id === "string" && id ? `/relacionamentos?id=${id}` : undefined);

export const FONTES: Record<FonteConfiguravel, Fonte> = {
  relacionamentos: {
    tabela: "relacionamentos",
    colunas:
      "id, empresa, owner_id, nome, categoria, cidade, temperatura, status_relacionamento, ultimo_contato_em, proximo_contato_em, obras_indicadas, valor_gerado, created_at, updated_at",
    ordem: "updated_at",
    donos: ["owner_id"],
    rotulo: (l) => String(l.nome ?? "Contato"),
    entidade: (l) => ({ tipo: "relacionamento", id: l.id as string }),
    acaoUrl: (l) => rel(l.id),
  },
  oportunidades: {
    tabela: "oportunidades",
    colunas: "id, empresa, owner_id, cliente, produto, valor, etapa, probabilidade, relacionamento_id, motivo_perda, created_at, updated_at",
    ordem: "updated_at",
    donos: ["owner_id"],
    rotulo: (l) => String(l.cliente ?? "Negócio"),
    entidade: (l) => ({ tipo: "oportunidade", id: l.id as string }),
    acaoUrl: (l) => rel(l.relacionamento_id),
  },
  leads: {
    tabela: "leads_recebidos",
    colunas:
      "id, empresa, nome, origem, status, classificacao, urgencia, natureza, resumo_ia, vendedor_id, sdr_id, relacionamento_id, created_at, respondido_em",
    ordem: "created_at",
    donos: ["vendedor_id", "sdr_id"],
    rotulo: (l) => String(l.nome ?? "Lead"),
    entidade: (l) => ({ tipo: "lead", id: l.id as string }),
    acaoUrl: (l) => rel(l.relacionamento_id),
  },
  atividades: {
    tabela: "atividades",
    colunas: "id, empresa, owner_id, tipo, subtipo, titulo, resultado, objetivo, proximo_passo, ocorrida_em, proximo_contato_em, relacionamento_id",
    ordem: "ocorrida_em",
    donos: ["owner_id"],
    rotulo: (l) => String(l.titulo ?? "Atividade"),
    entidade: (l) => (l.relacionamento_id ? { tipo: "relacionamento", id: l.relacionamento_id as string } : {}),
    acaoUrl: (l) => rel(l.relacionamento_id),
  },
  pos_vendas: {
    tabela: "pos_vendas",
    colunas:
      "id, empresa, vendedor_id, responsavel_id, cliente, produto, status, instalacao_agendada_em, instalacao_realizada_em, possui_reclamacao, reclamacao_resolvida, reclamacao_aberta_em, pos_venda_realizado_em, avaliacao_nota, relacionamento_id, created_at, updated_at",
    ordem: "updated_at",
    donos: ["responsavel_id", "vendedor_id"],
    rotulo: (l) => String(l.cliente ?? "Pós-venda"),
    entidade: (l) => ({ tipo: "pos_venda", id: l.id as string }),
    acaoUrl: () => "/pos-venda",
  },
  vendas: {
    tabela: "vendas",
    colunas: "id, empresa, owner_id, cliente, produto, valor, data, status, relacionamento_id, created_at",
    ordem: "data",
    donos: ["owner_id"],
    rotulo: (l) => String(l.cliente ?? "Venda"),
    entidade: (l) => (l.relacionamento_id ? { tipo: "relacionamento", id: l.relacionamento_id as string } : {}),
    acaoUrl: (l) => rel(l.relacionamento_id),
  },
  conversas_whatsapp: {
    // Só o que o supervisor do WhatsApp já resumiu: nunca telefone nem JID.
    tabela: "whatsapp_ia_leads",
    colunas:
      "id, empresa, owner_id, nome, etapa, resumo, proxima_acao, interesse, natureza, ultima_analise_em, relacionamento_id, oportunidade_id",
    ordem: "ultima_analise_em",
    donos: ["owner_id"],
    rotulo: (l) => String(l.nome ?? "Conversa"),
    entidade: (l) =>
      l.oportunidade_id
        ? { tipo: "oportunidade", id: l.oportunidade_id as string }
        : l.relacionamento_id
          ? { tipo: "relacionamento", id: l.relacionamento_id as string }
          : {},
    acaoUrl: (l) => rel(l.relacionamento_id),
    filtro: (q) => q.eq("ignorado", false),
  },
  campanhas: {
    tabela: "campanhas_marketing",
    colunas: "id, empresa, nome, canal, status, data_inicio, data_fim, orcamento, leads_gerados, criado_por, created_at",
    ordem: "created_at",
    donos: ["criado_por"],
    rotulo: (l) => String(l.nome ?? "Campanha"),
    entidade: (l) => ({ tipo: "campanha", id: l.id as string }),
    acaoUrl: () => "/marketing",
  },
};

const DESTINATARIOS = new Set(["dono", "gestor_da_loja", "pos_venda_da_loja", "marketing_da_loja"]);

/** Confere (sem confiar) uma configuração vinda do banco ou de uma proposta. */
export function configuracaoValida(v: unknown): ConfigAgenteConfiguravel | null {
  if (!v || typeof v !== "object") return null;
  const c = v as Record<string, unknown>;
  if (typeof c.fonte !== "string" || !(c.fonte in FONTES)) return null;
  if (typeof c.instrucoes !== "string" || !c.instrucoes.trim()) return null;
  if (typeof c.destinatario !== "string" || !DESTINATARIOS.has(c.destinatario)) return null;
  const agenda = agendaValida(c.agenda);
  if (!agenda) return null;
  // Agente criado pela equipe não roda mais que de hora em hora.
  if (agenda.tipo === "intervalo" && agenda.minutos < 60) return null;
  const limite = Math.min(TETO_ACHADOS, Math.max(1, Math.floor(Number(c.limitePorExecucao) || 10)));
  return {
    fonte: c.fonte as FonteConfiguravel,
    filtroDescricao: typeof c.filtroDescricao === "string" ? c.filtroDescricao : "",
    instrucoes: c.instrucoes,
    agenda,
    destinatario: c.destinatario as ConfigAgenteConfiguravel["destinatario"],
    limitePorExecucao: limite,
  };
}

function paraPrompt(l: Record<string, unknown>): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(l)) {
    if (v === null || v === undefined || v === "") continue;
    // ids de pessoa não ajudam a IA a escolher; o destinatário sai de regra.
    if (["owner_id", "vendedor_id", "sdr_id", "responsavel_id", "criado_por"].includes(k)) continue;
    saida[k] = typeof v === "string" && v.length > CARACTERES_POR_CAMPO ? `${v.slice(0, CARACTERES_POR_CAMPO)}…` : v;
  }
  return saida;
}

function destinatarios(
  config: ConfigAgenteConfiguravel,
  fonte: Fonte,
  linha: Record<string, unknown>,
  equipe: PessoaDaEquipe[],
): PessoaDaEquipe[] {
  const empresa = String(linha.empresa ?? "");
  switch (config.destinatario) {
    case "dono": {
      for (const col of fonte.donos) {
        const p = equipe.find((e) => e.id === linha[col]);
        if (p) return [p];
      }
      // Dono saiu da empresa: o item vai para quem manda na loja.
      return gestoresDaLoja(equipe, empresa);
    }
    case "gestor_da_loja":
      return gestoresDaLoja(equipe, empresa);
    case "pos_venda_da_loja":
      return posVendaDaLoja(equipe, empresa);
    case "marketing_da_loja":
      return marketingDaLoja(equipe, empresa);
  }
}

const PRIORIDADES: Prioridade[] = ["baixa", "media", "alta", "urgente"];

export async function executarConfiguravel(
  ctx: ContextoAgente,
  config: ConfigAgenteConfiguravel,
  meta: { id: string; nome: string },
): Promise<ResultadoAgente> {
  const fonte = FONTES[config.fonte];
  const sb: SupabaseClient = ctx.sb;

  let consulta = sb.from(fonte.tabela).select(fonte.colunas);
  if (fonte.filtro) consulta = fonte.filtro(consulta as unknown as FiltroQuery) as unknown as typeof consulta;
  const { data, error } = await consulta.order(fonte.ordem, { ascending: false, nullsFirst: false }).limit(ITENS_LIDOS);
  if (error) throw new Error(`Não consegui ler ${config.fonte}: ${error.message}`);
  const linhas = (data ?? []) as unknown as Record<string, unknown>[];
  if (!linhas.length) {
    return { resumo: `Nada para olhar em ${config.fonte} nesta rodada.`, achados: [], metricas: { lidos: 0 } };
  }

  const porId = new Map(linhas.map((l) => [String(l.id), l]));
  const limite = Math.min(TETO_ACHADOS, Math.max(1, config.limitePorExecucao));
  const resposta = await ctx.ia({
    perfil: "rapido",
    json: true,
    maxTokens: 2500,
    sistema: `Você é "${meta.nome}", um agente da equipe da AURA, o CRM de um grupo de lojas de lareiras e aquecimento.
O QUE VOCÊ PROCURA: ${config.filtroDescricao || "(não descrito)"}
INSTRUÇÕES DO GESTOR: ${config.instrucoes}

REGRAS FIXAS
- Você só SUGERE ação para uma pessoa da equipe. Nunca fala com cliente.
- Escolha no máximo ${limite} itens, só entre os ITENS recebidos (use o "id" exato).
- Não invente número, preço, prazo ou data: use só o que está nos itens.
- Título curto (até 80 caracteres); descrição com o próximo passo concreto, em português do Brasil, sem emojis.
- Se nada merece ação, devolva lista vazia.

Formato: {"achados":[{"id":"...","titulo":"...","descricao":"...","prioridade":"baixa|media|alta|urgente"}]}`,
    usuario: `ITENS (${config.fonte}, ${linhas.length}, mais recentes primeiro):\n${linhas
      .map((l) => JSON.stringify(paraPrompt(l)))
      .join("\n")}`,
  });

  if (!resposta || typeof resposta !== "object") {
    // Sem IA não há escolha: devolve vazio, e o motor não fecha nada como
    // "resolvido" porque a chamada falhou (ver rodarAgente).
    return { resumo: "Sem IA nesta rodada (saldo, orçamento ou falha); nada escolhido.", achados: [], metricas: { lidos: linhas.length, semIA: 1 } };
  }

  const escolhidos = Array.isArray(resposta.achados) ? resposta.achados : Array.isArray(resposta.itens) ? resposta.itens : [];
  const equipe = await equipeAtiva(sb);
  const achados: Achado[] = [];
  let aceitos = 0;
  for (const e of escolhidos as Array<Record<string, unknown>>) {
    if (aceitos >= limite) break;
    const linha = porId.get(String(e?.id ?? ""));
    const titulo = typeof e?.titulo === "string" ? e.titulo.trim() : "";
    if (!linha || !titulo) continue;
    const descricao = typeof e.descricao === "string" ? e.descricao.trim() : "";
    const prioridade = PRIORIDADES.includes(e.prioridade as Prioridade) ? (e.prioridade as Prioridade) : "media";
    const entidade = fonte.entidade(linha);
    aceitos += 1;
    for (const p of destinatarios(config, fonte, linha, equipe)) {
      achados.push({
        chave: `${config.fonte}:${linha.id}:${p.id}`,
        empresa: String(linha.empresa ?? p.empresa),
        destinatarioId: p.id,
        titulo,
        descricao: descricao || `${fonte.rotulo(linha)}: ${config.filtroDescricao}`,
        prioridade,
        entidadeTipo: entidade.tipo,
        entidadeId: entidade.id,
        acaoUrl: fonte.acaoUrl(linha),
        expiraEmDias: 7,
        podeGerarMensagem: ["relacionamento", "oportunidade", "pos_venda"].includes(entidade.tipo ?? ""),
      });
    }
  }

  return {
    resumo: aceitos
      ? `Olhei ${linhas.length} itens de ${config.fonte} e separei ${aceitos} para a equipe.`
      : `Olhei ${linhas.length} itens de ${config.fonte}; nada pediu ação hoje.`,
    achados,
    metricas: { lidos: linhas.length, escolhidos: aceitos },
  };
}
