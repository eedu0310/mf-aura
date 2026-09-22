// Sistema de Aprovação para Ações de Agentes IA Autônomos
// Define quais ações precisam de aprovação manual vs auto-execução

export type TipoAcao = 
  | "criar_compromisso"
  | "atualizar_proximo_contato"
  | "criar_relacionamento"
  | "registrar_atividade"
  | "atualizar_status_pos_venda"
  | "registrar_avaliacao_cliente"
  | "atualizar_oportunidade"
  | "concluir_compromisso"
  | "enviar_mensagem_whatsapp"
  | "enviar_email"
  | "criar_tarefas_automaticas";

export type NivelRisco = "baixo" | "medio" | "alto";

// Matriz de Aprovação: define risco de cada ação
export const MATRIX_APROVACAO: Record<TipoAcao, NivelRisco> = {
  // Auto-execute (baixo risco - não precisa aprovação)
  criar_compromisso: "baixo",
  atualizar_proximo_contato: "baixo",
  registrar_atividade: "baixo",
  enviar_mensagem_whatsapp: "baixo",

  // Requer aprovação (alto risco)
  atualizar_oportunidade: "alto",
  atualizar_status_pos_venda: "alto",
  criar_relacionamento: "alto",

  // Médio risco
  registrar_avaliacao_cliente: "medio",
  concluir_compromisso: "medio",
  enviar_email: "medio",
  criar_tarefas_automaticas: "bajo",
};

/**
 * Determina se uma ação precisa de aprovação manual
 * @param tipoAcao Tipo da ação a ser executada
 * @param parametros Parâmetros da ação para análise adicional
 * @returns true se precisa aprovação, false se pode executar automaticamente
 */
export function precisaAprovacao(
  tipoAcao: TipoAcao,
  parametros: Record<string, unknown>
): boolean {
  const nivelRisco = MATRIX_APROVACAO[tipoAcao];

  if (nivelRisco === "alto") {
    return true;
  }

  if (nivelRisco === "medio") {
    // Aprovação condicional: enviar_email com valor alto
    if (tipoAcao === "enviar_email") {
      const valor = parametros.valor as number | undefined;
      if (valor && valor > 50000) {
        return true;
      }
    }

    // Aprovação condicional: criar_relacionamento se dados incompletos
    if (tipoAcao === "criar_relacionamento") {
      const dados = parametros.dados as Record<string, unknown> | undefined;
      if (dados && !dados.email && !dados.telefone) {
        return true;
      }
    }

    return false;
  }

  // Baixo risco - nunca precisa aprovação
  return false;
}

/**
 * Retorna descrição legível da ação para dashboard de aprovações
 */
export function descricaoAcao(
  tipoAcao: TipoAcao,
  parametros: Record<string, unknown>
): string {
  switch (tipoAcao) {
    case "criar_compromisso":
      return `Criar compromisso: ${parametros.titulo || "sem título"}`;
    case "atualizar_proximo_contato":
      return `Agendar próximo contato para ${parametros.data_proxima || "data"}`;
    case "criar_relacionamento":
      return `Criar relacionamento com ${parametros.nome_empresa || "empresa"}`;
    case "registrar_atividade":
      return `Registrar atividade: ${parametros.tipo_atividade || "atividade"}`;
    case "atualizar_status_pos_venda":
      return `Atualizar status pós-venda para ${parametros.novo_status || "status"}`;
    case "registrar_avaliacao_cliente":
      return `Registrar avaliação do cliente`;
    case "atualizar_oportunidade":
      return `Atualizar oportunidade: ${parametros.titulo || "oportunidade"}`;
    case "concluir_compromisso":
      return `Concluir compromisso`;
    case "enviar_mensagem_whatsapp":
      return `Enviar WhatsApp para ${parametros.numero_destino || "contato"}`;
    case "enviar_email":
      return `Enviar email para ${parametros.destinatario || "destinatário"}`;
    case "criar_tarefas_automaticas":
      return `Criar tarefas automáticas (${parametros.quantidade || 1})`;
    default:
      return "Ação desconhecida";
  }
}
