/**
 * Lê TODAS as linhas de uma consulta, de mil em mil.
 *
 * O Supabase devolve no máximo 1000 linhas por pedido e não avisa que cortou:
 * a resposta vem "ok" com as primeiras mil. Foi assim que o teto de gasto da
 * IA somava só 1000 das 21 mil chamadas registradas e nunca bloqueava nada
 * (auditoria de 24/11/2026). Toda soma ou contagem que pode passar de mil
 * linhas deve passar por aqui — ou, melhor ainda, ser feita no banco.
 *
 * `montar(de, ate)` precisa devolver a consulta já com .order() por uma coluna
 * estável (o id, por exemplo): sem ordem, as páginas podem repetir ou pular
 * linhas entre um pedido e outro.
 */
const PAGINA = 1000;
const TETO_DE_PAGINAS = 500; // 500 mil linhas: trava de segurança contra laço infinito

export async function todasAsLinhas<T>(
  montar: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const saida: T[] = [];
  for (let pagina = 0; pagina < TETO_DE_PAGINAS; pagina++) {
    const de = pagina * PAGINA;
    const { data, error } = await montar(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    const linhas = data ?? [];
    saida.push(...linhas);
    if (linhas.length < PAGINA) break;
  }
  return saida;
}
