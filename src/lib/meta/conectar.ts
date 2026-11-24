/**
 * Conectar o Instagram de uma loja com um clique (login unificado da Meta).
 *
 * Apps criados na Meta a partir do fim de 2026 não podem mais usar o "login
 * do Instagram": o caminho é o Login do Facebook para Empresas com uma
 * configuração da API do Instagram (login unificado). A vantagem: o token
 * que volta é de usuário do sistema e NÃO VENCE — nada de renovar a cada 60
 * dias.
 *
 * Fluxo: botão → tela da Meta (o gestor escolhe a conta do Instagram da
 * loja) → volta para o AURA. O servidor troca o código pelo token, descobre
 * o id e o @ da conta, liga os avisos de mensagem e comentário e grava.
 *
 * Precisa, no .env.local do servidor:
 *   META_APP_ID           — ID do app "AURA CRM" no painel da Meta
 *   META_APP_SECRET       — Chave secreta do app (Configurações do app → Básico)
 *   META_LOGIN_CONFIG_ID  — ID da configuração "API do Instagram (login unificado)"
 * E no painel da Meta, URL de redirecionamento:
 *   https://crm.mflaser.com.br/api/meta/conectar/retorno
 */
import crypto from "node:crypto";

export const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://crm.mflaser.com.br").replace(/\/$/, "");
export const REDIRECT_URI = `${SITE}/api/meta/conectar/retorno`;
const VERSAO = process.env.META_API_VERSAO || "v23.0";
const GRAPH = `https://graph.facebook.com/${VERSAO}`;

export function credenciais() {
  const id = process.env.META_APP_ID?.trim();
  const segredo = process.env.META_APP_SECRET?.trim();
  const configId = process.env.META_LOGIN_CONFIG_ID?.trim();
  return id && segredo && configId ? { id, segredo, configId } : null;
}

// --- estado assinado: impede que alguém forje a volta da Meta -------------

interface Estado {
  empresa: string;
  userId: string;
  em: number;
}

export function assinarEstado(e: Omit<Estado, "em">, segredo: string): string {
  const corpo = Buffer.from(JSON.stringify({ ...e, em: Date.now() })).toString("base64url");
  const assinatura = crypto.createHmac("sha256", segredo).update(corpo).digest("base64url");
  return `${corpo}.${assinatura}`;
}

export function lerEstado(valor: string, segredo: string): Estado | null {
  const [corpo, assinatura] = valor.split(".");
  if (!corpo || !assinatura) return null;
  const esperada = crypto.createHmac("sha256", segredo).update(corpo).digest("base64url");
  const a = Buffer.from(assinatura);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const e = JSON.parse(Buffer.from(corpo, "base64url").toString()) as Estado;
    if (!e.em || Date.now() - e.em > 30 * 60_000) return null;
    return e;
  } catch {
    return null;
  }
}

export function urlDeAutorizacao(app: { id: string; configId: string }, estado: string): string {
  const q = new URLSearchParams({
    client_id: app.id,
    config_id: app.configId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    override_default_response_type: "true",
    state: estado,
  });
  return `https://www.facebook.com/${VERSAO}/dialog/oauth?${q}`;
}

async function json(res: Response) {
  const dados = await res.json().catch(() => ({}));
  if (!res.ok || dados?.error) {
    throw new Error(dados?.error?.message ?? `Erro ${res.status} da Meta.`);
  }
  return dados;
}

/** Código → token de usuário do sistema (não vence). */
export async function trocarCodigo(code: string, app: { id: string; segredo: string }) {
  const q = new URLSearchParams({
    client_id: app.id,
    client_secret: app.segredo,
    redirect_uri: REDIRECT_URI,
    code,
  });
  const r = await json(await fetch(`${GRAPH}/oauth/access_token?${q}`));
  if (!r.access_token) throw new Error("A Meta não devolveu o token.");
  // expires_in ausente ou 0 = não vence.
  const exp = Number(r.expires_in) || 0;
  return { token: String(r.access_token), expiraEmSegundos: exp > 0 ? exp : null };
}

export interface ContaInstagram {
  igUserId: string;
  usuario: string | null;
}

/** As contas do Instagram que o gestor liberou para o app nesta autorização. */
export async function contasLiberadas(token: string): Promise<ContaInstagram[]> {
  const q = new URLSearchParams({ fields: "id,username", access_token: token });
  const r = await json(await fetch(`${GRAPH}/me/assigned_instagram_accounts?${q}`)).catch(() => null);
  const lista: ContaInstagram[] = (r?.data ?? []).map((c: { id: string; username?: string }) => ({
    igUserId: String(c.id),
    usuario: c.username ?? null,
  }));
  if (lista.length) return lista;

  // Plano B: conta do Instagram ligada a uma Página liberada.
  const q2 = new URLSearchParams({ fields: "instagram_business_account{id,username}", access_token: token });
  const r2 = await json(await fetch(`${GRAPH}/me/accounts?${q2}`)).catch(() => null);
  return (r2?.data ?? [])
    .map((p: { instagram_business_account?: { id: string; username?: string } }) => p.instagram_business_account)
    .filter(Boolean)
    .map((c: { id: string; username?: string }) => ({ igUserId: String(c.id), usuario: c.username ?? null }));
}

/** Liga os avisos de DM e de comentário desta conta para o nosso app. */
export async function assinarAvisos(igUserId: string, token: string) {
  const q = new URLSearchParams({ subscribed_fields: "messages,comments", access_token: token });
  return json(await fetch(`${GRAPH}/${igUserId}/subscribed_apps?${q}`, { method: "POST" }));
}

/** Nome e @ de uma conta, com o token dela. */
export async function perfilDaConta(igUserId: string, token: string): Promise<ContaInstagram> {
  const q = new URLSearchParams({ fields: "id,username", access_token: token });
  const p = await json(await fetch(`${GRAPH}/${igUserId}?${q}`));
  return { igUserId: String(p.id ?? igUserId), usuario: p.username ? String(p.username) : null };
}
