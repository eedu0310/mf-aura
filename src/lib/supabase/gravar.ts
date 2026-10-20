/**
 * Confere que um UPDATE/DELETE realmente mexeu em alguma linha.
 *
 * O problema que isto resolve: o cliente do Supabase NUNCA lança erro, e
 * quando a política de RLS bloqueia a gravação ele devolve `error: null` e
 * zero linhas. A tela dizia "salvo", o F5 mostrava o valor antigo, e o
 * vendedor achava que o sistema tinha perdido o dado. Foi assim com o Cristian
 * ("não salva o contato") e com a Tatiane (pipeline com uma venda a menos).
 *
 * Uso:
 *
 *   await gravarExigindoLinha(
 *     supabase.from("oportunidades").update(payload, { count: "exact" }).eq("id", id),
 *     "o negócio",
 *   );
 *
 * Pede `{ count: "exact" }` em vez de `.select()`: o select depois de um
 * DELETE exige uma leitura RLS extra e fazia a exclusão parecer falhar mesmo
 * quando o DELETE foi aceito. O count vem do próprio comando.
 */

interface ErroDoBanco {
  message: string;
  code?: string;
  details?: string | null;
}

interface RespostaComContagem {
  count: number | null;
  error: ErroDoBanco | null;
}

export class GravacaoRecusada extends Error {
  constructor(
    mensagem: string,
    public readonly codigo: string | null,
  ) {
    super(mensagem);
    this.name = "GravacaoRecusada";
  }
}

/** Traduz os códigos que o vendedor mais encontra para uma frase que ele entende. */
export function explicarErroDoBanco(erro: ErroDoBanco, oQue: string): string {
  switch (erro.code) {
    case "42501":
      return `Você não tem permissão para alterar ${oQue}. Se ele for de outro vendedor, peça ao gestor.`;
    case "23505":
      return `Já existe um registro igual a ${oQue}: ${erro.details ?? erro.message}`;
    case "23503":
      return `${oQue} está ligado a outro registro e o banco não deixou. ${erro.message}`;
    case "PGRST301":
    case "401":
      return "Sua sessão expirou. Entre de novo e tente outra vez.";
    default:
      return `Não consegui salvar ${oQue}: ${erro.message}`;
  }
}

/**
 * Espera a gravação e lança GravacaoRecusada se o banco devolveu erro OU
 * nenhuma linha. Devolve quantas linhas mudaram.
 */
export async function gravarExigindoLinha(
  consulta: PromiseLike<RespostaComContagem>,
  oQue: string,
  minimo = 1,
): Promise<number> {
  const { count, error } = await consulta;
  if (error) throw new GravacaoRecusada(explicarErroDoBanco(error, oQue), error.code ?? null);
  const linhas = count ?? 0;
  if (linhas < minimo) {
    throw new GravacaoRecusada(
      `O banco não aceitou a alteração em ${oQue}. Ou o registro é de outro vendedor, ou sua sessão expirou — recarregue a página e tente de novo.`,
      "sem_linhas",
    );
  }
  return linhas;
}
