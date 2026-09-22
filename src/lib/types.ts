export type Cargo =
  | "Vendedor"
  | "Vendedor Interno"
  | "SDR"
  | "Pós-venda"
  | "Marketing"
  | "Gestor"
  | "Diretor";

export type Etapa =
  | "Prospecção"
  | "Apresentação"
  | "Proposta"
  | "Negociação"
  | "Fechados"
  | "Perdidos";

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
  origem?: string;
  cidade?: string;
  estado?: string;
  temperatura: TemperaturaRelacionamento;
  ultimoContato?: string;
  ultimoContatoEm?: string;
  proximoContato: string;
  proximoContatoEm?: string;
  valor?: number;
  valorGerado?: number;
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
}
