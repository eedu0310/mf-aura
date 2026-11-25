/**
 * EQUIPE VERMELHA — as regras puras (sem banco, sem rede) dos dois
 * "sabotadores do bem": o Caçador de Brechas e o Caçador de Erros.
 *
 * Pedido do dono (25/11/2026): agentes que tentam achar brecha e erro no
 * próprio CRM e dizem como arrumar. Eles só LEEM e SONDAM: não mudam código,
 * não mudam dado, não mandam requisição que grave nada e não fazem teste de
 * carga. Tudo o que é conta ou leitura de texto mora aqui para ter teste
 * (equipe-vermelha.teste.ts).
 */

export type Severidade = "baixa" | "media" | "alta" | "urgente";

/** Um problema achado, já com a sugestão de conserto escrita por regra. */
export interface Risco {
  /** Estável: o mesmo problema gera a mesma chave a cada rodada (o card não se repete). */
  chave: string;
  severidade: Severidade;
  titulo: string;
  detalhe: string;
  /** "Como arrumar", por regra. A IA (perfil rápido) só reescreve isto mais claro. */
  comoArrumar: string;
}

export const PESO_SEVERIDADE: Record<Severidade, number> = { urgente: 4, alta: 3, media: 2, baixa: 1 };

/** Do mais grave para o mais leve; dentro da mesma gravidade, pela chave (ordem estável). */
export function ordenarRiscos(riscos: Risco[]): Risco[] {
  return [...riscos].sort((a, b) => PESO_SEVERIDADE[b.severidade] - PESO_SEVERIDADE[a.severidade] || a.chave.localeCompare(b.chave));
}

/** Só alta e urgente viram card no Meu Dia dos gestores mestres; o resto fica no relato à Diretora. */
export function viraCard(r: Risco): boolean {
  return r.severidade === "alta" || r.severidade === "urgente";
}

/* ------------------------------------------------------------------ */
/* Esquema do banco (texto de aura_esquema_ddl())                      */
/* ------------------------------------------------------------------ */

export interface PoliticaDoEsquema {
  nome: string;
  tabela: string;
  comando: string; // select | insert | update | delete | all
  papeis: string[]; // em minúsculas: public, anon, authenticated…
  usando: string | null;
  comCheck: string | null;
}

/**
 * As políticas de RLS do texto do esquema. Formato de cada linha (gerado
 * pela função aura_esquema_ddl, migração do backup):
 *   create policy "nome" on public.tabela as permissive for select to public using (...) with check (...);
 */
export function politicasDoEsquema(ddl: string): PoliticaDoEsquema[] {
  const saida: PoliticaDoEsquema[] = [];
  const re = /^create policy ("(?:[^"]|"")+"|\S+) on public\.("?[\w]+"?) as (?:permissive|restrictive) for (\w+) to ([^;]*?)(?: using \((.*?)\))?(?: with check \((.*)\))?;\s*$/;
  // Política com condição longa ocupa várias linhas (subselect): junta até o ";".
  const linhas = ddl.split("\n");
  const comandos: string[] = [];
  for (let i = 0; i < linhas.length; i++) {
    if (!linhas[i].startsWith("create policy ")) continue;
    let comando = linhas[i];
    while (!/;\s*$/.test(comando) && i + 1 < linhas.length && !linhas[i + 1].startsWith("create policy ")) {
      comando += ` ${linhas[++i].trim()}`;
    }
    comandos.push(comando);
  }
  for (const linha of comandos) {
    if (!/ as permissive /.test(linha)) continue; // restritiva só tira acesso
    const m = re.exec(linha.trim());
    if (!m) continue;
    saida.push({
      nome: m[1].replace(/^"|"$/g, "").replace(/""/g, '"'),
      tabela: m[2].replace(/"/g, ""),
      comando: m[3].toLowerCase(),
      papeis: m[4].split(",").map((p) => p.trim().toLowerCase()).filter(Boolean),
      usando: m[5] ?? null,
      comCheck: m[6] ?? null,
    });
  }
  return saida;
}

/** "true" com ou sem parênteses e espaços. */
function ehVerdadeiro(expr: string | null): boolean {
  return expr !== null && /^\(*\s*true\s*\)*$/i.test(expr.trim());
}

/**
 * Política que deixa QUALQUER UM (sem login: papel anon, ou "public", que
 * inclui o anon) ler ou gravar a tabela inteira.
 */
export function politicaAbertaAoPublico(p: PoliticaDoEsquema): boolean {
  const aoPublico = p.papeis.includes("anon") || p.papeis.includes("public");
  if (!aoPublico) return false;
  if (p.comando === "insert") return ehVerdadeiro(p.comCheck);
  return ehVerdadeiro(p.usando) || ehVerdadeiro(p.comCheck);
}

export interface FuncaoDoEsquema {
  nome: string;
  definer: boolean;
  comSearchPath: boolean;
  gatilho: boolean;
  /** Papéis com EXECUTE (da linha de grant), em minúsculas. */
  executam: string[];
}

/**
 * As funções do esquema público: se rodam como dono (SECURITY DEFINER), se
 * fixam o search_path, se são de gatilho e quem pode executar.
 */
export function funcoesDoEsquema(ddl: string): FuncaoDoEsquema[] {
  const porNome = new Map<string, FuncaoDoEsquema>();
  const blocos = ddl.split(/^CREATE OR REPLACE FUNCTION public\./m).slice(1);
  for (const bloco of blocos) {
    const nome = /^"?([\w]+)"?\(/.exec(bloco)?.[1];
    if (!nome) continue;
    const fim = bloco.search(/^AS \$/m);
    const cabeca = fim === -1 ? bloco.slice(0, 600) : bloco.slice(0, fim);
    const atual = porNome.get(nome);
    const f: FuncaoDoEsquema = {
      nome,
      definer: /SECURITY DEFINER/i.test(cabeca),
      comSearchPath: /\bSET search_path\b/i.test(cabeca),
      gatilho: /RETURNS trigger\b/i.test(cabeca),
      executam: atual?.executam ?? [],
    };
    // Sobrecarga com o mesmo nome: vale a mais arriscada.
    if (atual) {
      f.definer ||= atual.definer;
      f.comSearchPath &&= atual.comSearchPath;
      f.gatilho &&= atual.gatilho;
    }
    porNome.set(nome, f);
  }
  const reGrant = /grant execute on function public\."?([\w]+)"?\([^)]*\) to ([^;]+);/gi;
  for (const m of ddl.matchAll(reGrant)) {
    const f = porNome.get(m[1]);
    if (!f) continue;
    const papeis = m[2].split(",").map((p) => p.trim().toLowerCase());
    f.executam = [...new Set([...f.executam, ...papeis])];
  }
  return [...porNome.values()];
}

/**
 * Funções que rodam como dono e que QUALQUER UM pode chamar de propósito: o
 * formulário público de avaliação (sem login, por token). Fora daqui,
 * função DEFINER que o anon executa é brecha.
 */
export const FUNCOES_PUBLICAS_DE_PROPOSITO = new Set(["buscar_empresa_por_token", "registrar_avaliacao_publica"]);

/* ------------------------------------------------------------------ */
/* Sondagem das rotas (GET sem login)                                  */
/* ------------------------------------------------------------------ */

/**
 * Rotas que só respondem com login. A sondagem faz GET SEM credencial e
 * espera 401/403 (ou redirecionar para o login). Só GET, só rotas de
 * leitura — e a do cron vai com ?simular=1, que nunca grava nada mesmo se
 * a senha do cron falhasse.
 */
export const ROTAS_PROTEGIDAS = [
  "/api/gestor/agentes",
  "/api/gestor/agentes/diretora",
  "/api/gestor/equipe",
  "/api/gestor/custo-ia",
  "/api/gestor/saude",
  "/api/gestor/permissoes",
  "/api/gestor/aprendizado",
  "/api/gestor/funil",
  "/api/gestor/relatorio-semanal",
  "/api/admin/usuarios",
  "/api/aura/supervisao",
  "/api/aura/gestor",
  "/api/meu-acesso",
  "/api/briefing",
  "/api/minha-agenda",
  "/api/ranking/geral",
  "/api/cron/agentes?simular=1&agente=orcamento",
];

export type ResultadoSondagem = "protegida" | "aberta" | "erro_servidor" | "sumiu" | "sem_resposta" | "estranho";

/** O que a resposta de um GET sem login quer dizer. `status` 0 = não respondeu. */
export function classificarSondagem(status: number, localizacao?: string | null): ResultadoSondagem {
  if (status === 0) return "sem_resposta";
  if (status === 401 || status === 403) return "protegida";
  if (status >= 300 && status < 400) return /login/i.test(localizacao ?? "") ? "protegida" : "estranho";
  if (status >= 200 && status < 300) return "aberta";
  if (status === 404) return "sumiu";
  if (status >= 500) return "erro_servidor";
  return "estranho";
}

/* ------------------------------------------------------------------ */
/* Links dos cards                                                     */
/* ------------------------------------------------------------------ */

/**
 * As telas que existem (src/app/**\/page.tsx). Mantida à mão: tela nova que
 * os cards usam entra aqui. Card com link para tela que não existe leva a
 * pessoa para o "página não encontrada" — é isso que o Caçador de Erros pega.
 */
export const TELAS_DO_APP = new Set([
  "/",
  "/academy",
  "/agenda",
  "/area-vendedor",
  "/atividades",
  "/aura-coach",
  "/compromissos-historico",
  "/configuracoes",
  "/gestor",
  "/gestor/compromissos-mensais",
  "/gestor/planilha-leads",
  "/instagram",
  "/leads",
  "/mapa-comercial",
  "/marketing",
  "/marketing/planilha-leads",
  "/materiais",
  "/meu-dia",
  "/pipeline",
  "/pos-venda",
  "/ranking",
  "/registrar-atividade",
  "/relacionamentos",
  "/relatorio",
  "/relatorios",
  "/relatorios-avancados",
  "/site-mf",
  "/vendas",
  "/whatsapp",
]);
/** Telas com pedaço variável no caminho (/avaliar/<token>, /materiais/<seção>…). */
const PREFIXOS_DE_TELA = ["/avaliar/", "/f/", "/s/", "/materiais/"];

/** O link de um card leva a uma tela que existe? Vazio vale (o card usa a tela do tipo). */
export function linkDeTelaValido(url: string | null | undefined): boolean {
  if (!url) return true;
  if (!url.startsWith("/") || url.startsWith("//")) return false;
  const caminho = url.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return TELAS_DO_APP.has(caminho) || PREFIXOS_DE_TELA.some((p) => caminho.startsWith(p) && caminho.length > p.length);
}

/* ------------------------------------------------------------------ */
/* Vocabulário dos status (o que o código entende)                     */
/* ------------------------------------------------------------------ */

/** StatusPosVenda (src/lib/types.ts). */
export const STATUS_POS_VENDA = new Set([
  "aguardando_instalacao",
  "agendamento_realizado",
  "instalacao_pendente",
  "reclamacao",
  "pos_venda_realizado",
  "cliente_antigo",
]);
/** StatusLead (src/lib/supabase/leads.ts). */
export const STATUS_LEAD = new Set(["aguardando_sdr", "atribuido_sdr", "respondido", "repassado_vendedor", "perdido", "lead_frio"]);

/* ------------------------------------------------------------------ */
/* Código ↔ banco                                                      */
/* ------------------------------------------------------------------ */

/**
 * As colunas de que o CRM (e a equipe de agentes) depende. Se uma some ou
 * muda de nome numa migração, o erro só aparece quando alguém abre a tela —
 * o Caçador de Erros pega antes. Lista mantida à mão: coluna nova crítica
 * entra aqui.
 */
export const COLUNAS_CRITICAS: Record<string, string[]> = {
  profiles: ["id", "empresa", "cargo", "ativo", "gestor_mestre", "gestor_aprovado", "excluido_em"],
  relacionamentos: ["id", "owner_id", "empresa", "nome", "proximo_contato_em", "ultimo_contato_em", "telefone_normalizado"],
  oportunidades: ["id", "owner_id", "empresa", "etapa", "valor", "relacionamento_id", "updated_at"],
  vendas: ["id", "owner_id", "empresa", "data", "valor", "valor_fechado", "relacionamento_id"],
  pos_vendas: ["id", "empresa", "status", "data_agendamento", "hora_agendamento", "nota_avaliacao", "possui_reclamacao", "reclamacao_aberta_em", "responsavel_id"],
  leads_recebidos: ["id", "empresa", "status", "prazo_resposta", "respondido_em", "natureza", "sdr_id", "vendedor_id"],
  whatsapp_ia_leads: ["id", "owner_id", "empresa", "alertas", "resumo", "natureza", "ignorado", "carteira_relacionamento_id"],
  aura_recomendacoes: ["id", "vendedor_id", "status", "agente", "chave", "expira_em", "acao_url", "pode_gerar_mensagem", "mensagem_sugerida", "atualizado_em"],
  aura_agentes: ["id", "ativo", "agenda", "config", "orcamento_mensal_usd", "proposta_id"],
  aura_agente_execucoes: ["id", "agente_id", "inicio", "fim", "status", "resumo", "metricas", "custo_usd", "erro"],
  aura_escritorio_mensagens: ["id", "de_agente", "para_agente", "tipo", "texto", "dados", "lida_por_agente"],
  aura_agente_propostas: ["id", "proposto_por", "nome", "setor", "config", "status", "decidido_por", "decidido_em"],
  aura_aprendizado: ["id", "status", "revisado_por_agente", "revisao_motivo", "revisao_confianca", "vezes_visto", "vezes_fechou"],
  notificacoes: ["id", "vendedor_id", "titulo", "mensagem", "tipo", "acao_url", "criada_em"],
  ia_uso: ["id", "funcao", "custo_usd", "criado_em"],
  ia_falhas: ["id", "funcao", "mensagem", "criado_em"],
  aura_execucoes_cron: ["id", "nome", "inicio", "ok"],
};

/* ------------------------------------------------------------------ */
/* Crons                                                               */
/* ------------------------------------------------------------------ */

/**
 * Cada cron (nome em aura_execucoes_cron, deploy/aura-crons) e de quanto em
 * quanto tempo, no máximo, ele tem de aparecer no diário — com folga.
 */
export const INTERVALO_MAXIMO_DO_CRON_H: Record<string, number> = {
  agentes: 1,
  "repassar-leads": 1,
  assistentes: 1,
  sentinela: 14,
  backup: 26,
  "briefing-do-dia": 26,
  "supervisao-aura": 26,
  "cobrar-metas": 26,
  "cobranca-supervisora": 50,
  "gerar-relatorios": 8 * 24 + 2,
  "aprendizado-do-dia": 8 * 24 + 2,
};

/** O cron parou? `ultimo` = início da última execução (ISO) ou null se nunca rodou. */
export function cronAtrasado(nome: string, ultimo: string | null, agora: Date): "nunca" | "parou" | null {
  const max = INTERVALO_MAXIMO_DO_CRON_H[nome];
  if (!max) return null;
  if (!ultimo) return "nunca";
  return agora.getTime() - Date.parse(ultimo) > max * 3_600_000 ? "parou" : null;
}

/** Junta as mensagens de erro parecidas (sem números, ids e aspas) para contar o mesmo erro uma vez. */
export function assinaturaDoErro(mensagem: string): string {
  return mensagem
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/g, "<id>")
    .replace(/\d+/g, "#")
    .replace(/["'`].*?["'`]/g, "…")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}
