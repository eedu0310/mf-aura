import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { diaEmSaoPaulo } from "@/lib/fuso";
import { todasAsLinhas } from "@/lib/supabase/todas-as-linhas";

/**
 * O status do pós-venda, vindo de src/lib/types.ts — que é o que o banco
 * aceita.
 *
 * AQUI HAVIA UMA SEGUNDA LISTA, escrita à mão, com TRÊS nomes que o banco
 * recusa: "instalacao_agendada", "instalacao_realizada" e "concluido". A
 * tabela pos_vendas tem um CHECK com os cinco nomes válidos, então qualquer
 * tentativa de mover um card para essas três colunas era rejeitada pelo banco.
 *
 * Na prática a tela de pós-venda inteira estava morta: metade das colunas não
 * podia receber nada, e o alerta de "instalação atrasada" nunca disparava
 * porque nada jamais ficava em "instalacao_agendada". Passou despercebido
 * porque só existe um registro de pós-venda no sistema — e ele está parado em
 * "aguardando_instalacao", o único nome que as duas listas tinham em comum.
 *
 * Os cinco nomes do banco são o vocabulário, e são estes:
 *
 *   aguardando_instalacao   a venda fechou, ninguém agendou ainda
 *   agendamento_realizado   tem data marcada com o cliente
 *   instalacao_pendente     a data passou e a instalação não aconteceu
 *   reclamacao              o cliente reclamou
 *   pos_venda_realizado     acabou
 *   cliente_antigo          comprou antes (ou fora) do CRM; o vendedor marcou
 *                           no WhatsApp. Não tem venda (migração 093).
 *
 * "Instalação realizada" e "Pós-venda concluído" eram dois nomes para o mesmo
 * fim de linha; viraram pos_venda_realizado.
 */
export type { StatusPosVenda } from "@/lib/types";
import type { StatusPosVenda } from "@/lib/types";

export interface PosVenda {
  id: string;
  /** Nulo no cliente antigo, que não tem venda registrada. */
  vendaId: string | null;
  origem: "venda" | "cliente_antigo";
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

  /*
   * Marcos do processo (colunas que a tabela sempre teve, mas que ninguém
   * preenchia). Agora atualizarPosVenda carimba cada um quando o passo
   * acontece. São opcionais: registro antigo vem sem eles, e as outras telas
   * que usam listarPosVendas não precisam saber que existem.
   */
  /** Quando a data de instalação foi marcada (ou remarcada) pela última vez. */
  instalacaoAgendadaEm?: string | null;
  /** Quando a instalação aconteceu (o dia agendado, se já passou; senão o dia em que concluíram). */
  instalacaoRealizadaEm?: string | null;
  /** Quando o pós-venda foi dado por concluído. */
  posVendaRealizadoEm?: string | null;
  possuiReclamacao?: boolean;
  reclamacaoAbertaEm?: string | null;
  reclamacaoResolvidaEm?: string | null;
  enderecoInstalacao?: string | null;
  /** Quem vendeu (o banco preenche ao registrar a venda). */
  vendedorId?: string | null;
  /** Quando o card entrou no pós-venda. */
  criadoEm?: string;
}

interface LinhaPosVenda {
  id: string;
  venda_id: string | null;
  origem: string | null;
  cliente: string | null;
  produto: string | null;
  created_at: string;
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
  instalacao_agendada_em?: string | null;
  instalacao_realizada_em?: string | null;
  pos_venda_realizado_em?: string | null;
  possui_reclamacao?: boolean | null;
  reclamacao_aberta_em?: string | null;
  reclamacao_resolvida_em?: string | null;
  endereco_instalacao?: string | null;
  vendedor_id?: string | null;
  vendas: { cliente: string; produto: string; valor: number; data: string } | null;
}

function doBanco(linha: LinhaPosVenda): PosVenda {
  return {
    id: linha.id,
    vendaId: linha.venda_id,
    origem: linha.origem === "cliente_antigo" ? "cliente_antigo" : "venda",
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
    // Cliente antigo não tem venda: o nome e o produto moram no próprio card.
    cliente: linha.vendas?.cliente ?? linha.cliente ?? "Cliente não encontrado",
    produto: linha.vendas?.produto ?? linha.produto ?? "",
    valor: Number(linha.vendas?.valor ?? 0),
    dataVenda: linha.vendas?.data ?? linha.created_at?.slice(0, 10) ?? "",
    telefone: linha.telefone ?? null,
    instalacaoAgendadaEm: linha.instalacao_agendada_em ?? null,
    instalacaoRealizadaEm: linha.instalacao_realizada_em ?? null,
    posVendaRealizadoEm: linha.pos_venda_realizado_em ?? null,
    possuiReclamacao: Boolean(linha.possui_reclamacao),
    reclamacaoAbertaEm: linha.reclamacao_aberta_em ?? null,
    reclamacaoResolvidaEm: linha.reclamacao_resolvida_em ?? null,
    enderecoInstalacao: linha.endereco_instalacao ?? null,
    vendedorId: linha.vendedor_id ?? null,
    criadoEm: linha.created_at,
  };
}

export async function listarPosVendas(): Promise<PosVenda[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  /*
   * De mil em mil até o fim: a consulta simples parava nas 1000 primeiras
   * linhas (teto do PostgREST) sem avisar, e o pós-venda mais antigo sumia
   * do quadro. Ordem estável (created_at e id) para as páginas não
   * repetirem nem pularem cards.
   */
  try {
    const linhas = await todasAsLinhas<LinhaPosVenda>((de, ate) =>
      supabase
        .from("pos_vendas")
        .select("*, vendas(cliente, produto, valor, data)")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(de, ate)
        .then((r) => ({ data: r.data as unknown as LinhaPosVenda[] | null, error: r.error })),
    );
    return linhas.map(doBanco);
  } catch (error) {
    console.error("Erro ao carregar pós-vendas:", error);
    return [];
  }
}

/** Os marcos que o banco já tem gravados, para só carimbar o que está vazio. */
interface MarcosAtuais {
  origem: string | null;
  data_agendamento: string | null;
  reclamacao: string | null;
  instalacao_agendada_em: string | null;
  instalacao_realizada_em: string | null;
  pos_venda_realizado_em: string | null;
  reclamacao_aberta_em: string | null;
  reclamacao_resolvida_em: string | null;
}

/**
 * Quando a instalação aconteceu. Se a data agendada já passou (ou é hoje), é
 * ela: quem conclui o card dias depois não deve empurrar a instalação para o
 * dia do clique — é dessa data que sai a limpeza de chaminé de um ano depois.
 * Meio-dia em Brasília, para o dia não escorregar com o fuso.
 */
function momentoDaInstalacao(dataAgendamento: string | null | undefined) {
  if (dataAgendamento && dataAgendamento.slice(0, 10) <= diaEmSaoPaulo()) {
    return new Date(`${dataAgendamento.slice(0, 10)}T12:00:00-03:00`).toISOString();
  }
  return new Date().toISOString();
}

/**
 * Carimba os marcos do processo a partir do que está sendo salvo:
 *
 *   data de instalação salva (nova ou mudou) → instalacao_agendada_em
 *   status vira pos_venda_realizado           → instalacao_realizada_em e
 *                                               pos_venda_realizado_em (só se vazios)
 *   reclamação escrita                         → possui_reclamacao e
 *                                               reclamacao_aberta_em (se vazio)
 *   reclamação marcada como resolvida          → reclamacao_resolvida_em (se vazio);
 *                                               desmarcada, o carimbo sai
 *
 * Só ACRESCENTA: nenhum campo antigo muda de sentido. Devolve, já no formato
 * da tela, o que foi carimbado — para quem salvou atualizar a lista sem
 * esperar a sincronização ao vivo.
 */
function carimbarMarcos(
  patch: Partial<PosVenda>,
  atual: MarcosAtuais,
  payload: Record<string, unknown>,
): Partial<PosVenda> {
  const agora = new Date().toISOString();
  const carimbos: Partial<PosVenda> = {};

  if (patch.dataAgendamento) {
    const mudou = patch.dataAgendamento !== atual.data_agendamento;
    if (mudou || !atual.instalacao_agendada_em) {
      payload.instalacao_agendada_em = agora;
      carimbos.instalacaoAgendadaEm = agora;
    }
  }

  if (patch.status === "pos_venda_realizado") {
    const dataInstalacao = patch.dataAgendamento !== undefined ? patch.dataAgendamento : atual.data_agendamento;
    // Cliente antigo sem data não teve instalação pelo CRM: concluir o card
    // dele não pode inventar uma data de instalação (é dela que sai a
    // previsão da limpeza da chaminé).
    const semInstalacao = atual.origem === "cliente_antigo" && !dataInstalacao;
    if (!atual.instalacao_realizada_em && !semInstalacao) {
      const quando = momentoDaInstalacao(dataInstalacao);
      payload.instalacao_realizada_em = quando;
      carimbos.instalacaoRealizadaEm = quando;
    }
    if (!atual.pos_venda_realizado_em) {
      payload.pos_venda_realizado_em = agora;
      carimbos.posVendaRealizadoEm = agora;
    }
  }

  if (patch.reclamacao !== undefined) {
    const temTexto = Boolean(patch.reclamacao?.trim());
    payload.possui_reclamacao = temTexto;
    carimbos.possuiReclamacao = temTexto;
    // Reclamação nova (antes não havia texto) recomeça a contagem de idade.
    const nova = temTexto && !atual.reclamacao?.trim();
    if (temTexto && (nova || !atual.reclamacao_aberta_em)) {
      payload.reclamacao_aberta_em = agora;
      carimbos.reclamacaoAbertaEm = agora;
    }
  }

  const textoFinal = patch.reclamacao !== undefined ? patch.reclamacao : atual.reclamacao;
  const temReclamacao = Boolean(textoFinal?.trim());
  if (patch.reclamacaoResolvida === true && temReclamacao) {
    // Resolvida agora (ou reaberta e resolvida de novo): carimba se vazio.
    const reaberta = Boolean(carimbos.reclamacaoAbertaEm);
    if (!atual.reclamacao_resolvida_em || reaberta) {
      payload.reclamacao_resolvida_em = agora;
      carimbos.reclamacaoResolvidaEm = agora;
    }
  } else if (patch.reclamacaoResolvida === false && atual.reclamacao_resolvida_em) {
    // Desmarcou "resolvida": a reclamação voltou a ficar aberta.
    payload.reclamacao_resolvida_em = null;
    carimbos.reclamacaoResolvidaEm = null;
  }

  return carimbos;
}

/**
 * Salva o pós-venda. Devolve `ok` e os marcos carimbados (quem só chama e
 * ignora o retorno continua funcionando como antes).
 */
export async function atualizarPosVenda(
  id: string,
  patch: Partial<PosVenda>,
): Promise<{ ok: boolean; carimbos: Partial<PosVenda> }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { ok: false, carimbos: {} };

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
  if (patch.enderecoInstalacao !== undefined) payload.endereco_instalacao = patch.enderecoInstalacao;

  // Os marcos dependem do que já está gravado ("só se vazio"), então lê antes.
  // Se a leitura falhar, salva do mesmo jeito, só sem carimbar.
  let carimbos: Partial<PosVenda> = {};
  const mexeEmMarco =
    patch.dataAgendamento !== undefined ||
    patch.status !== undefined ||
    patch.reclamacao !== undefined ||
    patch.reclamacaoResolvida !== undefined;
  if (mexeEmMarco) {
    const { data: atual, error: erroLeitura } = await supabase
      .from("pos_vendas")
      .select(
        "origem, data_agendamento, reclamacao, instalacao_agendada_em, instalacao_realizada_em, pos_venda_realizado_em, reclamacao_aberta_em, reclamacao_resolvida_em",
      )
      .eq("id", id)
      .maybeSingle();
    if (erroLeitura) console.error("Erro ao ler os marcos do pós-venda:", erroLeitura);
    else if (atual) carimbos = carimbarMarcos(patch, atual as MarcosAtuais, payload);
  }

  const { error } = await supabase.from("pos_vendas").update(payload).eq("id", id);
  if (error) {
    console.error("Erro ao atualizar pós-venda:", error);
    return { ok: false, carimbos: {} };
  }
  return { ok: true, carimbos };
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

  // Também de mil em mil, com ordem estável (ver listarPosVendas).
  let todas: PosVenda[];
  try {
    const linhas = await todasAsLinhas<LinhaPosVenda>((de, ate) =>
      supabase
        .from("pos_vendas")
        .select("*, vendas!inner(cliente, produto, valor, data, owner_id)")
        .eq("vendas.owner_id", user.id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(de, ate)
        .then((r) => ({ data: r.data as unknown as LinhaPosVenda[] | null, error: r.error })),
    );
    todas = linhas.map(doBanco);
  } catch (error) {
    console.error("Erro ao carregar pendências de pós-venda:", error);
    return [];
  }
  const hojeISO = diaEmSaoPaulo(); // UTC acusava atraso de véspera depois das 21h

  return todas.filter((pv) => {
    const reclamacaoAberta = Boolean(pv.reclamacao?.trim()) && !pv.reclamacaoResolvida;
    const atrasada =
      pv.status === "agendamento_realizado" && Boolean(pv.dataAgendamento) && pv.dataAgendamento! < hojeISO;
    return reclamacaoAberta || atrasada;
  });
}
