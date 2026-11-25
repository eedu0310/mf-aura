/**
 * Os últimos avisos que a Meta mandou para o webhook, em memória.
 *
 * Serve ao diagnóstico do gestor mestre: quando "a mensagem não chegou", a
 * primeira pergunta é se a Meta chegou a bater aqui, com que assinatura e de
 * qual conta. Guarda só o envelope (quando, que conta, que campo, se a loja
 * foi reconhecida) — nunca o texto do cliente. Some quando o servidor
 * reinicia, e tudo bem: é para olhar na hora.
 */
export interface AvisoRecebido {
  em: string;
  assinaturaOk: boolean;
  objeto: string | null;
  contas: string[];
  campos: string[];
  lojas: (string | null)[];
  erro?: string;
}

const g = globalThis as unknown as { __auraMetaAvisos?: AvisoRecebido[] };
const lista: AvisoRecebido[] = (g.__auraMetaAvisos ??= []);

export function registrarAviso(a: AvisoRecebido) {
  lista.unshift(a);
  if (lista.length > 40) lista.length = 40;
}

export function ultimosAvisos() {
  return lista.slice();
}
