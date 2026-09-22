import { criarNotificacao } from "@/lib/supabase/notificacoes";

// Notificação de Compromisso Próximo
export async function notificarCompromissoProximo(
  vendedorId: string,
  titulo: string,
  descricao: string
) {
  await criarNotificacao(
    vendedorId,
    titulo,
    descricao,
    "compromisso",
    "/agenda"
  );
}

// Notificação de Lead Frio
export async function notificarLeadFrio(
  vendedorId: string,
  nomeCliente: string
) {
  await criarNotificacao(
    vendedorId,
    "Lead Esfriando ❄️",
    `${nomeCliente} está com temperatura baixa. Faça um contato urgente!`,
    "lead_frio",
    "/relacionamentos"
  );
}

// Notificação de Tarefa Urgente
export async function notificarTarefaUrgente(
  vendedorId: string,
  nomeTarefa: string
) {
  await criarNotificacao(
    vendedorId,
    "Tarefa Urgente ⚡",
    nomeTarefa,
    "tarefa_urgente",
    "/meu-dia"
  );
}

// Saudação Personalizada
export async function notificarSaudacao(
  vendedorId: string,
  nome: string
) {
  const hora = new Date().getHours();
  let saudacao = "Bom dia";
  let mensagem = "Que o seu dia seja produtivo! 🌅";

  if (hora >= 12 && hora < 18) {
    saudacao = "Boa tarde";
    mensagem = "Você está indo bem! Continue assim! 🌤️";
  } else if (hora >= 18) {
    saudacao = "Boa noite";
    mensagem = "Que você descanse bem e amanhã seja melhor! 🌙";
  }

  await criarNotificacao(
    vendedorId,
    `${saudacao}, ${nome}!`,
    mensagem,
    "saudacao",
    "/meu-dia"
  );
}

// Notificação de Venda
export async function notificarVenda(
  vendedorId: string,
  nomeCliente: string,
  valor: number
) {
  const valorFormatado = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

  await criarNotificacao(
    vendedorId,
    "🎉 Venda Realizada!",
    `${nomeCliente} - ${valorFormatado}`,
    "venda",
    "/vendas"
  );
}

// Notificação de Meta Atingida
export async function notificarMetaAtingida(
  vendedorId: string,
  percentual: number
) {
  await criarNotificacao(
    vendedorId,
    "🏆 Meta Atingida!",
    `Parabéns! Você alcançou ${percentual}% da sua meta este mês!`,
    "meta_atingida",
    "/meu-dia"
  );
}

// Notificação de Alerta Geral
export async function notificarAlerta(
  vendedorId: string,
  titulo: string,
  mensagem: string
) {
  await criarNotificacao(
    vendedorId,
    titulo,
    mensagem,
    "alerta"
  );
}