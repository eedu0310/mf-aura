/**
 * Lembra por alguns segundos quem é o dono de um token.
 *
 * O proxy roda em toda requisição e chamava `auth.getUser()` (uma ida ao
 * Supabase) mais uma consulta ao perfil para saber se a conta segue ativa.
 * A rota então chamava `getUser()` de novo. Eram três idas ao banco antes
 * de o pedido fazer qualquer coisa — e a tela do WhatsApp faz três pedidos
 * por segundo com uma conversa aberta, sendo que a busca de mensagens lê de
 * memória e não precisa de banco nenhum.
 *
 * A chave é o token, não o usuário: token diferente nunca aproveita a
 * resposta de outro. Um token é um JWT assinado — se ele foi validado há
 * vinte segundos, continua válido agora.
 *
 * O preço disso é a janela: desativar uma conta leva até TTL para expulsar
 * quem já está com a tela aberta. Um minuto é aceitável para o gestor e
 * economiza milhares de consultas por hora.
 */

const TTL_MS = 60_000;
const TETO = 500;

interface Sessao {
  userId: string;
  ativo: boolean;
  em: number;
}

const g = globalThis as unknown as { __auraSessoes?: Map<string, Sessao> };
const mapa = (g.__auraSessoes ??= new Map<string, Sessao>());

/** O token vem do cookie de sessão; serve só como chave, nunca é registrado. */
export function sessaoLembrada(token: string): Sessao | null {
  const s = mapa.get(token);
  if (!s) return null;
  if (Date.now() - s.em > TTL_MS) {
    mapa.delete(token);
    return null;
  }
  return s;
}

export function lembrarSessao(token: string, userId: string, ativo: boolean) {
  if (!token) return;
  // Mapa sem teto vira vazamento num processo que não reinicia.
  if (mapa.size >= TETO) {
    const maisAntigo = mapa.keys().next().value;
    if (maisAntigo) mapa.delete(maisAntigo);
  }
  mapa.set(token, { userId, ativo, em: Date.now() });
}

export function esquecerSessao(token: string) {
  mapa.delete(token);
}

/**
 * O cookie de sessão do Supabase, que muda a cada renovação de token — por
 * isso serve de chave: token novo, validação nova.
 */
export function tokenDaRequisicao(cookies: { name: string; value: string }[]) {
  const auth = cookies.filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name));
  if (!auth.length) return "";
  return auth
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => c.value)
    .join("");
}
