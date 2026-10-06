import type { OrigemLead } from "./origem-lead";
export type Cargo =
  | "Vendedor"
  | "Vendedor Interno"
  | "SDR"
  | "Pós-venda"
  | "Marketing"
  | "Gestor";

/**
 * Quem atende cliente e por isso entra em ranking, relatório e supervisão.
 *
 * EXISTE PORQUE A LISTA ESTAVA ESCRITA À MÃO EM SETE LUGARES, e em três deles
 * faltava "Vendedor Interno" — metade da equipe. Na prática, Jociane, Deise,
 * Denise, Jucelane e Sabrina ficavam de fora do relatório automático, da
 * supervisão da AURA e da contagem de vendedores ativos do resumo do gestor.
 * As pessoas com mais clientes na carteira eram as invisíveis, e nada no
 * sistema avisava — o relatório simplesmente não era gerado para elas.
 *
 * Uma lista só, importada. Cargo novo entra aqui e vale em todo lugar.
 */
export const CARGOS_QUE_VENDEM: Cargo[] = ["Vendedor", "Vendedor Interno"];

/**
 * A etapa é texto livre porque o gestor edita o funil.
 *
 * Era uma lista fixa de seis nomes. Enquanto foi fixa, o compilador garantia
 * que ninguém escrevesse uma etapa inexistente — e também impedia o gestor de
 * criar a dele. Quem garante agora é o funil da loja: toda pergunta sobre
 * etapa passa pelos ajudantes de @/lib/funil, que respondem pelo PAPEL dela
 * (é a de ganho? conta no pipeline?) em vez de comparar o nome.
 */
export type Etapa = string;

export type Probabilidade = "Baixa" | "Média" | "Alta";

export type MotivoPerda =
  | "Concorrência"
  | "Sem orçamento"
  | "Mudança de fornecedor"
  | "Falta de interesse"
  | "Outro";

export type TipoAtividade =
  | "Ligação"
  | "Email"
  | "Visita"
  | "Reunião"
  | "Follow-up"
  | "WhatsApp"
  | "Orçamento"
  | "Venda"
  | "Prospecção"
  | "Pós-venda"
  | "Treinamento"
  | "Outro";

export type TemperaturaRelacionamento =
  | "quente"
  | "ativo"
  | "esfriando"
  | "frio";

export type CategoriaRelacionamento =
  | "Cliente Final"
  | "Arquiteto"
  | "Construtora"
  | "Revendedor"
  | "Engenheiro"
  | "Designer de Interiores"
  | "Consultor"
  | "Obra"
  | "Distribuidor"
  | "Outro";

export type StatusPosVenda =
  | "aguardando_instalacao"
  | "agendamento_realizado"
  | "instalacao_pendente"
  | "reclamacao"
  | "pos_venda_realizado";

export type TipoPeriodoMeta = "mensal" | "anual";

export interface UserProfile {
  id?: string;
  nome: string;
  email: string;
  empresa: string;
  cargo: Cargo;
  ativo: boolean;
  created_at?: string;
}

export interface Venda {
  id: string;
  vendedorId: string;
  cliente: string;
  valor: number;
  valorOriginal?: number;
  valorFechado?: number;
  descontoValor?: number;
  descontoPercentual?: number;
  formaPagamento?: string;
  quantidadeParcelas?: number;
  valorParcela?: number;
  entradaValor?: number;
  taxaFinanceira?: number;
  comissaoBase?: number;
  comissaoPercentual?: number;
  comissaoValor?: number;
  tipo?: string;
  produto?: string;
  descricao?: string;
  origem?: string;
  data: string;
  loja?: string;
  empresa?: string;
  relacionamentoId?: string;
  oportunidadeId?: string;
  indicadorId?: string;
  ownerId?: string;
  /** Atendimento em dupla: o colega que entrou junto nesta venda. */
  parceiroId?: string | null;
  /** Quanto da venda é do parceiro, de 0 a 100. O dono fica com o resto.
   *  A conta de quem levou quanto está em src/lib/parceria.ts. */
  percentualParceiro?: number | null;
  status?: string;
  criadoEm?: string;
  atualizado?: string;
}

export interface Atividade {
  id: string;
  vendedorId: string;
  empresa?: string;
  tipo: TipoAtividade;
  subtipo?: string;
  titulo: string;
  contexto: string;
  anotacoes?: string;
  resultado?: string;
  objetivo?: string;
  proximoPasso?: string;
  quando: string;
  ocorridaEm?: string;
  proximoContatoEm?: string;
  relacionamentoId?: string;
  clienteNome?: string;
  clienteTelefone?: string;
  clienteEmail?: string;
  clienteCategoria?: CategoriaRelacionamento;
  origem?: string;
  latitude?: number;
  longitude?: number;
  precisaoMetros?: number;
  endereco?: string;
  localizacaoCapturadaEm?: string;
  origemDispositivo?: string;
  metadata?: Record<string, unknown>;
  criadoEm: string;
  atualizado?: string;
  ownerId?: string;
}

export interface Relacionamento {
  id: string;
  vendedorId: string;
  ownerId?: string;
  empresa?: string;
  nome: string;
  email?: string;
  telefone?: string;
  categoria: CategoriaRelacionamento;
  /** Texto livre histórico ("Marketing", "Site", "WhatsApp"...). Mantido porque
   *  há dado antigo nele; para relatório use origemLead. */
  origem?: string;
  /** Origem comercial no vocabulário fechado da casa (enum origem_lead no
   *  banco). É esta que o trigger estampa na oportunidade, na atividade e na
   *  venda, e que o relatório do marketing soma. */
  origemLead?: OrigemLead | null;
  campanhaId?: string | null;
  cidade?: string;
  estado?: string;
  temperatura: TemperaturaRelacionamento;
  ultimoContato?: string;
  ultimoContatoEm?: string;
  proximoContato: string;
  proximoContatoEm?: string;
  valor?: number;
  valorGerado?: number;
  /** Atendimento em dupla: o colega que também atende este cliente. Ele vê a
   *  ficha e a conversa, mas o cliente continua na carteira do dono. */
  parceiroId?: string | null;
  /** A divisão combinada com o parceiro, de 0 a 100 para ele. Padrão 50. O
   *  negócio nasce com ela e a venda herda. */
  percentualParceiro?: number | null;
  parceriaEm?: string | null;
  parceriaMotivo?: string | null;
  criadoEm?: string;
  atualizado?: string;
}

export interface Lead {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  empresa?: string;
  origem?: string;
  atribuidoPara?: string;
  relacionamentoId?: string;
  status?: string;
  criadoEm?: string;
}

export interface Tarefa {
  id: string;
  vendedorId: string;
  titulo: string;
  descricao?: string;
  concluida: boolean;
  prioridade: "baixa" | "media" | "alta";
  criadaEm: string;
  vencimento?: string;
}

export interface Meta {
  id: string;
  vendedorId: string;
  mes: string;
  valor: number;
  realizado?: number;
  empresa?: string;
  ano?: number;
  tipoPeriodo?: TipoPeriodoMeta;
  periodoInicio?: string;
  periodoFim?: string;
  criadoEm?: string;
  atualizado?: string;
}

export interface NivelPerformance {
  id: string;
  vendedorId: string;
  nivel: number;
  nome: string;
  descricao?: string;
  requisitos?: string;
  recompensas?: string;
  criadoEm?: string;
}

export interface PosVenda {
  id: string;
  vendaId: string;
  oportunidadeId?: string;
  relacionamentoId?: string;
  vendedorId: string;
  responsavelId?: string;
  empresa: string;
  cliente: string;
  telefone?: string;
  email?: string;
  produto?: string;
  valorFechado: number;
  status: StatusPosVenda;
  instalacaoAgendadaEm?: string;
  instalacaoRealizadaEm?: string;
  enderecoInstalacao?: string;
  observacaoInstalacao?: string;
  possuiReclamacao: boolean;
  reclamacao?: string;
  reclamacaoAbertaEm?: string;
  reclamacaoResolvida: boolean;
  reclamacaoResolvidaEm?: string;
  posVendaRealizadoEm?: string;
  avaliouLoja: boolean;
  avaliacaoNota?: number;
  avaliacaoComentario?: string;
  criadoEm?: string;
  atualizado?: string;
}

export interface TransferenciaCarteira {
  id: string;
  empresa: string;
  usuarioOrigemId: string;
  usuarioDestinoId: string;
  criadoPor: string;
  motivo?: string;
  relacionamentosTransferidos: number;
  oportunidadesTransferidas: number;
  desativouOrigem: boolean;
  criadoEm: string;
}

export interface Notificacao {
  id: string;
  vendedorId: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  lida: boolean;
  acaoUrl?: string;
  criadaEm: string;
  lidaEm?: string;
}

export interface CompromissoMensal {
  id: string;
  vendedorId: string;
  empresa: string;
  mes: string;
  metaFaturamento: number;
  metaClientesNovos: number;
  metaArquitetos: number;
  metaConstrutoras: number;
  metaObras: number;
  metaVisitas: number;
  metaLigacoes: number;
  objetivoPessoal?: string | null;
  status:
    | "rascunho"
    | "pendente_aprovacao"
    | "aprovado"
    | "ajuste_solicitado"
    | "rejeitado";
  feedbackGestor?: string | null;
  aprovadoPor?: string | null;
  dataEnvio?: string;
  notificacao_visualizada?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Compromisso {
  id: string;
  vendedorId: string;
  titulo: string;
  subtitulo?: string;
  relacionamentoNome?: string;
  tipo: "Visita" | "Reunião" | "Follow-up" | "Ligação" | "Outro";
  data: string;
  hora?: string;
  local?: string;
  descricao?: string;
  concluido: boolean;
  criadoEm?: string;
}

export interface Motivo {
  id: string;
  motivo: MotivoPerda;
  descricao?: string;
  criadoEm?: string;
}

export interface Oportunidade {
  id: string;
  cliente: string;
  valor: number;
  etapa: Etapa;
  probabilidade: Probabilidade;
  produto?: string;
  descricao?: string;
  motivoPerda?: MotivoPerda | null;
  descricaoPerda?: string | null;
  dataPerda?: string | null;
  relacionamentoId?: string;
  ownerId?: string;
  ownerNome?: string;
  criadoEm?: string;
  atualizado?: string;
  empresa?: string;
  diasParado?: number;
  /** Orçamento anexado (caminho no armazenamento e nome original). */
  orcamentoPath?: string | null;
  orcamentoNome?: string | null;
  /** Atendimento em dupla: o colega que trabalha este negócio junto. Quando o
   *  negócio é ganho, ele vai para a venda e o valor é dividido. */
  parceiroId?: string | null;
  /** A divisão combinada, de 0 a 100 para o parceiro. Padrão 50. */
  percentualParceiro?: number | null;
}
