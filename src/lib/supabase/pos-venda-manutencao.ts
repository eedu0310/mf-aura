import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { diaEmSaoPaulo } from "@/lib/fuso";

/**
 * Manutenções do pós-venda: a limpeza anual da chaminé (e a revisão anual)
 * de quem comprou lareira.
 *
 * O pós-venda não acaba na instalação. Lareira a lenha junta fuligem e
 * creosoto na chaminé; por segurança e rendimento, a limpeza é uma vez por
 * ano. Então, cerca de um ano depois de instalar, a loja liga para o cliente
 * e oferece a limpeza — é atendimento e é venda de serviço.
 *
 * Os registros moram na tabela pos_venda_manutencoes (migração 108). Enquanto
 * ela não existir no banco, toda função aqui devolve `disponivel: false` em
 * vez de quebrar: a tela mostra a PREVISÃO calculada (instalação + 12 meses),
 * só para leitura, e avisa que agendar e registrar ligam quando o cadastro de
 * manutenções for ativado no banco.
 */

export type TipoManutencao = "limpeza_chamine" | "revisao" | "outro";
export type StatusManutencao = "prevista" | "agendada" | "realizada" | "cancelada";

export const ROTULO_TIPO: Record<TipoManutencao, string> = {
  limpeza_chamine: "Limpeza de chaminé",
  revisao: "Revisão anual",
  outro: "Outra manutenção",
};

/** Tipos que se repetem todo ano: concluir um já deixa o próximo previsto. */
export const TIPOS_ANUAIS: TipoManutencao[] = ["limpeza_chamine", "revisao"];

export interface Manutencao {
  id: string;
  posVendaId: string;
  empresa: string;
  tipo: TipoManutencao;
  /** "AAAA-MM-DD": quando deveria acontecer. */
  dataPrevista: string;
  /** "AAAA-MM-DD": quando foi combinada com o cliente. */
  dataAgendada: string | null;
  hora: string | null;
  status: StatusManutencao;
  realizadaEm: string | null;
  observacao: string | null;
  responsavelId: string | null;
  criadoEm: string;
}

interface LinhaManutencao {
  id: string;
  pos_venda_id: string;
  empresa: string;
  tipo: TipoManutencao;
  data_prevista: string;
  data_agendada: string | null;
  hora: string | null;
  status: StatusManutencao;
  realizada_em: string | null;
  observacao: string | null;
  responsavel_id: string | null;
  created_at: string;
}

function doBanco(l: LinhaManutencao): Manutencao {
  return {
    id: l.id,
    posVendaId: l.pos_venda_id,
    empresa: l.empresa,
    tipo: l.tipo,
    dataPrevista: l.data_prevista,
    dataAgendada: l.data_agendada,
    hora: l.hora,
    status: l.status,
    realizadaEm: l.realizada_em,
    observacao: l.observacao,
    responsavelId: l.responsavel_id,
    criadoEm: l.created_at,
  };
}

const TABELA = "pos_venda_manutencoes";

/**
 * A tabela ainda não existe no banco? O Postgres responde 42P01 ("relation
 * does not exist") e o PostgREST, que olha o próprio cache, PGRST205 ("Could
 * not find the table ... in the schema cache").
 */
export function tabelaAusente(erro: { code?: string; message?: string } | null | undefined) {
  if (!erro) return false;
  if (erro.code === "42P01" || erro.code === "PGRST205") return true;
  const msg = erro.message ?? "";
  return msg.includes("Could not find the table") || (msg.includes(TABELA) && msg.includes("does not exist"));
}

export type ListaManutencoes = { disponivel: true; registros: Manutencao[] } | { disponivel: false; registros: [] };

export type ResultadoManutencao =
  | { ok: true; disponivel: true }
  | { ok: false; disponivel: boolean; erro: string };

const SEM_TABELA: ResultadoManutencao = {
  ok: false,
  disponivel: false,
  erro: "O cadastro de manutenções ainda não foi ativado no banco.",
};

function falha(erro: { code?: string; message?: string }, contexto: string): ResultadoManutencao {
  if (tabelaAusente(erro)) return SEM_TABELA;
  console.error(`Erro ao ${contexto}:`, erro);
  return { ok: false, disponivel: true, erro: "Não deu para salvar. Tente de novo em instantes." };
}

/** Lê tudo, de mil em mil (o PostgREST corta cada resposta em mil linhas). */
export async function listarManutencoes(): Promise<ListaManutencoes> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { disponivel: false, registros: [] };

  const PAGINA = 1000;
  const linhas: LinhaManutencao[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase
      .from(TABELA)
      .select("*")
      .order("data_prevista", { ascending: true })
      .order("id", { ascending: true })
      .range(de, de + PAGINA - 1);
    if (error) {
      if (!tabelaAusente(error)) console.error("Erro ao carregar manutenções:", error);
      // Erro qualquer (rede, permissão) também cai na previsão: melhor mostrar
      // a conta do que uma tela vazia.
      return { disponivel: false, registros: [] };
    }
    linhas.push(...((data ?? []) as LinhaManutencao[]));
    if (!data || data.length < PAGINA) break;
  }
  return { disponivel: true, registros: linhas.map(doBanco) };
}

/* ------------------------------------------------------------- datas */

/**
 * Soma meses a "AAAA-MM-DD". Se o dia não existe no mês de chegada (29/02 num
 * ano que não é bissexto, 31 num mês de 30), fica no último dia do mês.
 */
export function somarMeses(dia: string, meses: number) {
  const [ano, mes, d] = dia.slice(0, 10).split("-").map(Number);
  const total = ano * 12 + (mes - 1) + meses;
  const novoAno = Math.floor(total / 12);
  const novoMes = (total % 12) + 1;
  const ultimo = new Date(Date.UTC(novoAno, novoMes, 0)).getUTCDate();
  return `${novoAno}-${String(novoMes).padStart(2, "0")}-${String(Math.min(d, ultimo)).padStart(2, "0")}`;
}

/* ------------------------------------------------------------ escrita */

/**
 * Em quem a ação mexe: um registro que já existe, ou um novo — a previsão
 * calculada (que ainda não tem linha no banco) vira registro na primeira ação.
 */
export type AlvoManutencao =
  | { id: string }
  | { nova: { posVendaId: string; empresa: string; tipo: TipoManutencao; dataPrevista: string } };

async function gravar(alvo: AlvoManutencao, campos: Record<string, unknown>, contexto: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { resultado: SEM_TABELA };
  const agora = new Date().toISOString();

  if ("id" in alvo) {
    const { error } = await supabase
      .from(TABELA)
      .update({ ...campos, updated_at: agora })
      .eq("id", alvo.id);
    return { resultado: error ? falha(error, contexto) : ({ ok: true, disponivel: true } as const) };
  }

  const { posVendaId, empresa, tipo, dataPrevista } = alvo.nova;
  const { error } = await supabase.from(TABELA).insert({
    pos_venda_id: posVendaId,
    empresa,
    tipo,
    data_prevista: dataPrevista,
    status: "prevista",
    ...campos,
  });
  return { resultado: error ? falha(error, contexto) : ({ ok: true, disponivel: true } as const) };
}

/** Cria uma manutenção avulsa (ou a primeira limpeza de um cliente antigo). */
export async function criarManutencao(dados: {
  posVendaId: string;
  empresa: string;
  tipo: TipoManutencao;
  dataPrevista: string;
  observacao?: string | null;
}): Promise<ResultadoManutencao> {
  const { posVendaId, empresa, tipo, dataPrevista, observacao } = dados;
  const { resultado } = await gravar(
    { nova: { posVendaId, empresa, tipo, dataPrevista } },
    { observacao: observacao?.trim() || null },
    "criar manutenção",
  );
  return resultado;
}

/** Combina dia (e hora, se tiver) com o cliente. */
export async function agendarManutencao(
  alvo: AlvoManutencao,
  dataAgendada: string,
  hora: string | null,
): Promise<ResultadoManutencao> {
  const { resultado } = await gravar(
    alvo,
    { status: "agendada", data_agendada: dataAgendada, hora: hora || null },
    "agendar manutenção",
  );
  return resultado;
}

/**
 * Marca como feita e, se o tipo se repete todo ano, já deixa a próxima
 * prevista para 12 meses depois do dia em que foi feita.
 */
export async function concluirManutencao(
  alvo: AlvoManutencao,
  dados: { tipo: TipoManutencao; posVendaId: string; empresa: string; observacao?: string | null },
): Promise<ResultadoManutencao> {
  const { resultado } = await gravar(
    alvo,
    { status: "realizada", realizada_em: new Date().toISOString(), observacao: dados.observacao?.trim() || null },
    "concluir manutenção",
  );
  if (!resultado.ok || !TIPOS_ANUAIS.includes(dados.tipo)) return resultado;

  const proxima = somarMeses(diaEmSaoPaulo(), 12);
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return resultado;
  const { error } = await supabase.from(TABELA).insert({
    pos_venda_id: dados.posVendaId,
    empresa: dados.empresa,
    tipo: dados.tipo,
    data_prevista: proxima,
    status: "prevista",
  });
  // 23505: já existe uma em aberto do mesmo tipo (índice único da migração).
  // Não é erro: a próxima já está lá.
  if (error && error.code !== "23505") {
    console.error("Erro ao prever a próxima manutenção:", error);
    return { ok: false, disponivel: true, erro: "Ficou registrada como feita, mas a próxima não foi prevista." };
  }
  return resultado;
}

/** Cancela (cliente não quis, vendeu a casa, trocou de aparelho...). */
export async function cancelarManutencao(alvo: AlvoManutencao, motivo?: string | null): Promise<ResultadoManutencao> {
  const campos: Record<string, unknown> = { status: "cancelada" };
  if (motivo?.trim()) campos.observacao = motivo.trim();
  const { resultado } = await gravar(alvo, campos, "cancelar manutenção");
  return resultado;
}
