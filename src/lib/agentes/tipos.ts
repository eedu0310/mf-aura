/**
 * CONTRATO DA EQUIPE DE AGENTES DA AURA.
 *
 * Pedido do Elton (25/11/2026): um agente para cada função do CRM, trabalhando
 * junto com a IA; uma AURA que aprende com os agentes e com as conversas do
 * WhatsApp e guarda isso na base de conhecimento (sem nunca perder); e um
 * "escritório virtual" onde dá para ver os agentes trabalhando, conversando
 * entre si, propondo agentes novos e os que eles já criaram — com uma diretora
 * comandando todos.
 *
 * Desenho (docs/agentes.md tem a versão longa):
 *
 *   AURA DIRETORA  ── lê o que cada agente relatou, monta o plano do dia,
 *        │            cobra quem está com muito achado parado, e propõe
 *        │            agentes novos quando vê um buraco que ninguém cobre.
 *        ▼
 *   AGENTES DE FUNÇÃO (src/lib/agentes/nativos/*) ── cada um olha uma parte
 *        │   do CRM com REGRAS (de graça, sem inventar número) e só chama a IA
 *        │   onde ela agrega: escrever, resumir, reconhecer padrão em conversa.
 *        ▼
 *   SAÍDAS ── achados (viram recomendação para a pessoa certa, sem repetir e
 *             com prazo de validade), um aviso-resumo por pessoa por dia,
 *             mensagens no escritório, sugestões para a base de conhecimento
 *             e propostas de agente novo.
 *
 * REGRAS FIXAS (valem para todo agente, inclusive os criados pela Diretora):
 *   1. Nenhum agente envia mensagem para cliente. Ele SUGERE; o vendedor envia.
 *   2. Nenhum agente altera dado de negócio (venda, cliente, etapa, dono).
 *      Ele escreve só nas tabelas da própria equipe (recomendações, avisos,
 *      escritório, propostas, sugestões de conhecimento).
 *   3. O código do WhatsApp (Baileys) não é tocado: os agentes só LEEM o que o
 *      supervisor do WhatsApp já grava no banco.
 *   4. Toda chamada de IA passa por podeChamarIA() e pelo orçamento do agente,
 *      e fica registrada em ia_uso como "agente/<id>".
 *   5. Número que aparece em texto de IA tem de vir dos dados de entrada.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type IdAgente = string;

/** Departamento do escritório: agrupa as mesas na tela. */
/**
 * "atendimento" = os agentes que CONVERSAM com o cliente (Instagram, chat do site, WhatsApp).
 * "seguranca" = a Equipe Vermelha: os "sabotadores" que só LEEM e SONDAM o
 * próprio CRM procurando brecha e erro, e dizem como arrumar (nunca mexem).
 */
export type Setor =
  | "direcao"
  | "vendas"
  | "atendimento"
  | "pos-venda"
  | "marketing"
  | "gestao"
  | "conhecimento"
  | "dados"
  | "seguranca";

export type Prioridade = "baixa" | "media" | "alta" | "urgente";

/** Quando o agente roda. Horas e dias no fuso de São Paulo. */
export type Agenda =
  | { tipo: "intervalo"; minutos: number }
  | { tipo: "diario"; horas: number[]; minuto?: number; diasSemana?: number[] /* 0=dom … 6=sáb; vazio = todos */ };

/** Um item que precisa de ação de alguém. Vira linha em aura_recomendacoes. */
export interface Achado {
  /**
   * Chave estável: o mesmo problema na mesma entidade gera a MESMA chave a
   * cada rodada (ex.: "followup:vencido:<relacionamento_id>"). É o que impede
   * a recomendação de se repetir todo dia — o motor atualiza em vez de criar.
   */
  chave: string;
  empresa: string;
  /** Quem recebe (profiles.id). O motor descarta achado sem destinatário. */
  destinatarioId: string;
  titulo: string;
  descricao: string;
  prioridade: Prioridade;
  entidadeTipo?: "relacionamento" | "oportunidade" | "lead" | "pos_venda" | "manutencao" | "campanha" | "compromisso" | "perfil";
  entidadeId?: string;
  /** Para onde o botão leva (caminho interno, "/relacionamentos?id=…"). */
  acaoUrl?: string;
  /** Depois disso some sozinho se ninguém resolveu (e volta se o problema continuar). */
  expiraEmDias: number;
  /** Mostra o botão "Gerar mensagem" (a IA escreve; o vendedor envia). */
  podeGerarMensagem?: boolean;
}

/** Fala no escritório virtual: relato, pedido, resposta, ideia, alerta… */
export interface MensagemEscritorio {
  de: IdAgente;
  /** Agente destinatário, "todos" (mural) ou ausente (= para a Diretora). */
  para?: IdAgente | "todos";
  tipo: "relato" | "pedido" | "resposta" | "ideia" | "alerta" | "aprendizado" | "plano";
  texto: string;
  empresa?: string;
  dados?: Record<string, unknown>;
}

/** Algo que a AURA deveria saber. Entra em aura_aprendizado como "sugerido". */
export interface SugestaoConhecimento {
  empresa: string;
  canal?: string; // padrão "whatsapp"
  tipo: string; // "objecao", "pergunta_frequente", "argumento", "produto", "processo"…
  gatilho: string; // a situação/pergunta do cliente
  resposta: string; // o que funciona responder/fazer
  fonte: string; // "agente/<id>"
  /** 0–1. O Curador aprova sozinho acima do limite e com evidência de resultado. */
  confianca: number;
}

/**
 * Agente criado pela própria equipe (proposto por um agente, aprovado pelo
 * gestor). Ele só pode ler as FONTES abaixo e só produz achados — o motor
 * genérico (src/lib/agentes/configuravel.ts) faz o resto.
 */
export type FonteConfiguravel =
  | "relacionamentos"
  | "oportunidades"
  | "leads"
  | "atividades"
  | "pos_vendas"
  | "vendas"
  | "conversas_whatsapp"
  | "campanhas";

export interface ConfigAgenteConfiguravel {
  fonte: FonteConfiguravel;
  /** Em palavras: o que o agente procura nessa fonte. */
  filtroDescricao: string;
  /** Instrução para a IA decidir o que vira achado e como escrever. */
  instrucoes: string;
  agenda: Agenda;
  destinatario: "dono" | "gestor_da_loja" | "pos_venda_da_loja" | "marketing_da_loja";
  limitePorExecucao: number;
}

export interface PropostaAgente {
  propostoPor: IdAgente;
  nome: string;
  setor: Setor;
  missao: string;
  justificativa: string;
  config: ConfigAgenteConfiguravel;
}

export interface ResultadoAgente {
  /** Uma frase para o escritório ("Achei 34 follow-ups vencidos em 3 lojas"). */
  resumo: string;
  achados: Achado[];
  mensagens?: MensagemEscritorio[];
  aprendizados?: SugestaoConhecimento[];
  propostas?: PropostaAgente[];
  /** Números da rodada para o painel (ex.: { vencidos: 305, esfriando: 1112 }). */
  metricas?: Record<string, number>;
}

/** Chamada de IA já com orçamento, saldo, timeout e registro de custo. */
export interface ChamadaIA {
  sistema: string;
  usuario: string;
  /** "rapido" = Haiku (padrão), "redacao" = Sonnet. Resolvido em src/lib/aura/modelos.ts. */
  perfil?: "rapido" | "redacao";
  maxTokens?: number;
  /** Pede JSON e já devolve o objeto (null se a IA não devolveu JSON válido). */
  json?: boolean;
}

export interface ContextoAgente {
  /** Cliente com a chave de serviço (os agentes rodam no servidor, pelo cron). */
  sb: SupabaseClient;
  agora: Date;
  /** "AAAA-MM-DD" em São Paulo. */
  hoje: string;
  agente: IdAgente;
  /**
   * IA com trava: devolve null (e o agente segue só com regras) se não houver
   * saldo, se o orçamento do agente acabou ou se a IA falhar.
   */
  ia: (chamada: ChamadaIA) => Promise<string | Record<string, unknown> | null>;
  /**
   * Até quando a rodada pode ir (epoch em ms). Passou disso, o motor corta a
   * rodada e NADA do que o agente achou é gravado. Agente com laço de IA
   * confere antes de abrir chamada nova (o ctx.ia já recusa sozinho quando
   * não dá mais tempo). Ausente na simulação e nos testes.
   */
  prazo?: number;
  /** Lê as mensagens recentes do escritório endereçadas a este agente. */
  caixaDeEntrada: () => Promise<Array<MensagemEscritorio & { id: string; criadoEm: string }>>;
  log: (...partes: unknown[]) => void;
}

export interface DefinicaoAgente {
  id: IdAgente;
  nome: string;
  /** O "cargo" na mesa do escritório ("Analista de follow-up"). */
  cargo: string;
  setor: Setor;
  /** Nome de ícone do lucide-react ("PhoneCall", "Sparkles"…). */
  icone: string;
  missao: string;
  agenda: Agenda;
  usaIA: boolean;
  /** Teto de gasto de IA do agente por mês, em dólar. */
  orcamentoMensalUsd: number;
  /** "nativo" = escrito no código; "sistema" = rotina que já existia (sentinela, backup…). */
  tipo: "nativo" | "sistema" | "configuravel";
  executar?: (ctx: ContextoAgente) => Promise<ResultadoAgente>;
}

/* ------------------------------------------------------------------ */
/* O que a tela do escritório recebe (GET /api/gestor/agentes).        */
/* ------------------------------------------------------------------ */

export type EstadoMesa = "trabalhando" | "ocioso" | "com_erro" | "desligado" | "aguardando_ativacao";

export interface MesaAgente {
  id: IdAgente;
  nome: string;
  cargo: string;
  setor: Setor;
  icone: string;
  missao: string;
  tipo: DefinicaoAgente["tipo"];
  ativo: boolean;
  estado: EstadoMesa;
  /** O que está fazendo agora ou fez por último, em uma frase. */
  fazendoAgora: string;
  ultimaExecucao: { inicio: string; fim: string | null; status: "ok" | "erro" | "rodando"; resumo: string } | null;
  proximaExecucao: string | null;
  agendaTexto: string; // "Todo dia às 7h40" / "A cada 5 minutos"
  /** Achados abertos e resolvidos nos últimos 30 dias. */
  achadosAbertos: number;
  achadosResolvidos30d: number;
  custo30dUsd: number;
  orcamentoMensalUsd: number;
  criadoPor: "sistema" | "diretora" | "agente" | "gestor";
  criadoEm: string | null;
  /** Últimas 10 rodadas, da mais nova para a mais antiga (gaveta do agente). */
  execucoes?: Array<{
    inicio: string;
    fim: string | null;
    status: "ok" | "erro" | "rodando";
    resumo: string;
    achados: number;
    custoUsd: number;
  }>;
}

export interface FalaEscritorio {
  id: string;
  de: IdAgente;
  deNome: string;
  para: IdAgente | "todos" | null;
  paraNome: string | null;
  tipo: MensagemEscritorio["tipo"];
  texto: string;
  empresa: string | null;
  criadoEm: string;
}

export interface PropostaListada {
  id: string;
  propostoPor: IdAgente;
  propostoPorNome: string;
  nome: string;
  setor: Setor;
  missao: string;
  justificativa: string;
  config: ConfigAgenteConfiguravel;
  status: "proposta" | "aprovada" | "recusada" | "criada";
  criadoEm: string;
  decididoEm: string | null;
  /** Id do agente que nasceu desta proposta (aura_agentes.proposta_id), se já foi criado. */
  agenteCriadoId?: string;
}

export interface EstadoEscritorio {
  /** false enquanto a migração 110 não estiver no banco: a tela mostra a equipe e o aviso. */
  ativo: boolean;
  motivoInativo?: string;
  mesas: MesaAgente[];
  falas: FalaEscritorio[];
  propostas: PropostaListada[];
  /** O plano do dia escrito pela Diretora (texto curto), se houver. */
  planoDoDia: { texto: string; criadoEm: string } | null;
  conhecimento: {
    aprendizadosAprovados: number;
    aprendizadosSugeridos: number;
    materiais: number;
    trechos: number;
    ultimaVersao: string | null; // última alteração registrada no histórico
    ultimoBackup: string | null; // última cópia da base de conhecimento na nuvem
  };
  custo30dUsd: number;
}

/* ------------------------------------------------------------------ */
/* Conversa do gestor com a Diretora (/api/gestor/agentes/diretora).   */
/* ------------------------------------------------------------------ */

/**
 * Uma mensagem da conversa particular gestor ⇄ Diretora. Fica gravada em
 * aura_escritorio_mensagens (de "gestor:<id>" para a Diretora e de volta),
 * então também aparece no mural da equipe.
 */
export interface MensagemConversaDiretora {
  id: string;
  autor: "gestor" | "diretora";
  texto: string;
  criadoEm: string;
  /** Na resposta dela: os agentes para quem ela passou um pedido. */
  encaminhados?: Array<{ agenteId: string; agenteNome: string; pedido: string }>;
  /** Na resposta dela: o agente novo que ela propôs (espera o gestor mestre na aba Propostas). */
  proposta?: { nome: string; setor: Setor; gravada: boolean } | null;
  /** A IA não estava disponível (saldo, orçamento, falha): resposta padrão. */
  semIA?: boolean;
}

export interface ConversaDiretora {
  diretora: { id: IdAgente; nome: string } | null;
  mensagens: MensagemConversaDiretora[];
}
