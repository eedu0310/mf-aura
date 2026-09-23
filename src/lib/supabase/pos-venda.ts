import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type StatusPosVenda =
  | "aguardando_instalacao"
  | "instalacao_agendada"
  | "instalacao_realizada"
  | "instalacao_pendente"
  | "reclamacao"
  | "concluido";

export interface PosVenda {
  id: string;
  vendaId: string;
  empresa: string;
  status: StatusPosVenda;
  dataAgendamento: string | null;
  horaAgendamento: string | null;
  observacao: string | null;
  reclamacao: string | null;
  reclamacaoResolvida: boolean;
  avaliouLoja: boolean;
  notaAvaliacao: number | null;
  comentarioAvaliacao: string | null;
  tokenAvaliacao: string;
  // dados da venda vinculada
  cliente: string;
  produto: string;
  valor: number;
  dataVenda: string;
  /** Telefone do cliente, preenchido pelo banco quando a venda é registrada. */
  telefone: string | null;
}

interface LinhaPosVenda {
  id: string;
  venda_id: string;
  empresa: string;
  status: StatusPosVenda;
  data_agendamento: string | null;
  hora_agendamento: string | null;
  observacao: string | null;
  reclamacao: string | null;
  reclamacao_resolvida: boolean;
  avaliou_loja: boolean;
  nota_avaliacao: number | null;
  comentario_avaliacao: string | null;
  token_avaliacao: string;
  telefone: string | null;
  vendas: { cliente: string; produto: string; valor: number; data: string } | null;
}

function doBanco(linha: LinhaPosVenda): PosVenda {
  return {
    id: linha.id,
    vendaId: linha.venda_id,
    empresa: linha.empresa,
    status: linha.status,
    dataAgendamento: linha.data_agendamento,
    horaAgendamento: linha.hora_agendamento,
    observacao: linha.observacao,
    reclamacao: linha.reclamacao,
    reclamacaoResolvida: linha.reclamacao_resolvida,
    avaliouLoja: linha.avaliou_loja,
    notaAvaliacao: linha.nota_avaliacao,
    comentarioAvaliacao: linha.comentario_avaliacao,
    tokenAvaliacao: linha.token_avaliacao,
    cliente: linha.vendas?.cliente ?? "Cliente não encontrado",
    produto: linha.vendas?.produto ?? "",
    valor: Number(linha.vendas?.valor ?? 0),
    dataVenda: linha.vendas?.data ?? "",
    telefone: linha.telefone ?? null,
  };
}

export async function listarPosVendas(): Promise<PosVenda[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("pos_vendas")
    .select("*, vendas(cliente, produto, valor, data)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar pós-vendas:", error);
    return [];
  }
  return (data as unknown as LinhaPosVenda[]).map(doBanco);
}

export async function atualizarPosVenda(id: string, patch: Partial<PosVenda>) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.dataAgendamento !== undefined) payload.data_agendamento = patch.dataAgendamento;
  if (patch.horaAgendamento !== undefined) payload.hora_agendamento = patch.horaAgendamento;
  if (patch.observacao !== undefined) payload.observacao = patch.observacao;
  if (patch.reclamacao !== undefined) payload.reclamacao = patch.reclamacao;
  if (patch.reclamacaoResolvida !== undefined) payload.reclamacao_resolvida = patch.reclamacaoResolvida;
  if (patch.avaliouLoja !== undefined) payload.avaliou_loja = patch.avaliouLoja;
  if (patch.notaAvaliacao !== undefined) payload.nota_avaliacao = patch.notaAvaliacao;
  if (patch.comentarioAvaliacao !== undefined) payload.comentario_avaliacao = patch.comentarioAvaliacao;

  const { error } = await supabase.from("pos_vendas").update(payload).eq("id", id);
  if (error) console.error("Erro ao atualizar pós-venda:", error);
}

export interface NotaPosVenda {
  id: string;
  autorNome: string | null;
  texto: string;
  criadoEm: string;
}

export async function listarNotas(posVendaId: string): Promise<NotaPosVenda[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("pos_venda_notas")
    .select("id, autor_nome, texto, created_at")
    .eq("pos_venda_id", posVendaId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erro ao carregar notas:", error);
    return [];
  }
  return (data ?? []).map((n) => ({
    id: n.id,
    autorNome: n.autor_nome,
    texto: n.texto,
    criadoEm: n.created_at,
  }));
}

export async function adicionarNota(posVendaId: string, autorNome: string, texto: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const { error } = await supabase
    .from("pos_venda_notas")
    .insert({ pos_venda_id: posVendaId, autor_nome: autorNome, texto });

  if (error) console.error("Erro ao adicionar nota:", error);
}

/**
 * Pendências de pós-venda (reclamações abertas ou instalações
 * atrasadas) nas vendas que EU fiz — usado em "Meu Dia" pra
 * qualquer vendedor, mesmo sem acesso à aba inteira de Pós-venda.
 */
export async function listarMinhasPendenciasPosVenda(): Promise<PosVenda[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("pos_vendas")
    .select("*, vendas!inner(cliente, produto, valor, data, owner_id)")
    .eq("vendas.owner_id", user.id);

  if (error) {
    console.error("Erro ao carregar pendências de pós-venda:", error);
    return [];
  }

  const todas = (data as unknown as LinhaPosVenda[]).map(doBanco);
  const hojeISO = new Date().toISOString().slice(0, 10);

  return todas.filter((pv) => {
    const reclamacaoAberta = Boolean(pv.reclamacao?.trim()) && !pv.reclamacaoResolvida;
    const atrasada =
      pv.status === "instalacao_agendada" && Boolean(pv.dataAgendamento) && pv.dataAgendamento! < hojeISO;
    return reclamacaoAberta || atrasada;
  });
}
