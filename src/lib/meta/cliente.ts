/**
 * A conversa com a API da Meta.
 *
 * Só existe um caminho para o Instagram — o oficial — e ele é bem mais
 * estreito que o do WhatsApp. Duas regras que moldam tudo aqui:
 *
 *  1. Não se inicia conversa. O cliente escreve primeiro, e isso abre uma
 *     janela de 24 horas que reinicia a cada mensagem dele. Fora da janela a
 *     Meta recusa o envio — por isso a janela é guardada na conversa e
 *     conferida ANTES de tentar, para o vendedor ver o motivo em vez de um
 *     erro cru.
 *  2. O token é da loja, não da pessoa. Ele vive em `meta_contas`, que nenhum
 *     usuário logado consegue ler; só o servidor.
 */
import { getSupabaseServiceClient } from "@/lib/supabase/service";

// Login unificado: as chamadas vão para graph.facebook.com com o id da conta.
const BASE = process.env.META_API_BASE || "https://graph.facebook.com";
const VERSAO = process.env.META_API_VERSAO || "v23.0";

export const FORA_DA_JANELA =
  "O prazo de 24 horas para responder esta pessoa terminou. O Instagram só libera de novo quando ela escrever outra vez — é regra da Meta.";

export interface ContaMeta {
  id: string;
  empresa: string;
  igUserId: string | null;
  token: string;
}

/** A conta conectada de uma loja, com o token. Só use no servidor. */
export async function contaDaLoja(empresa: string): Promise<ContaMeta | null> {
  const sb = getSupabaseServiceClient();
  if (!sb) return null;
  const { data } = await sb
    .from("meta_contas")
    .select("id, empresa, ig_user_id, token, ativo")
    .eq("empresa", empresa)
    .maybeSingle();
  if (!data?.ativo || !data.token) return null;
  return { id: data.id, empresa: data.empresa, igUserId: data.ig_user_id, token: data.token };
}

async function chamar(caminho: string, token: string, corpo?: Record<string, unknown>) {
  const url = `${BASE}/${VERSAO}/${caminho}`;
  const res = await fetch(url, {
    method: corpo ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await res.json().catch(() => ({}));
  if (!res.ok) {
    // A Meta devolve o motivo em error.message; sem isso o vendedor veria
    // apenas "erro 400" e ninguém saberia o que houve.
    const motivo = dados?.error?.message ?? `Erro ${res.status} da Meta.`;
    throw new Error(motivo);
  }
  return dados;
}

/** Responde uma DM. `destinatario` é o id do cliente no Instagram. */
export async function enviarMensagem(conta: ContaMeta, destinatario: string, texto: string) {
  const alvo = conta.igUserId || "me";
  return chamar(`${alvo}/messages`, conta.token, {
    recipient: { id: destinatario },
    message: { text: texto },
  });
}

/** Responde um comentário de publicação. */
export async function responderComentario(conta: ContaMeta, comentarioId: string, texto: string) {
  return chamar(`${comentarioId}/replies`, conta.token, { message: texto });
}

/** Esconde ou mostra um comentário. */
export async function ocultarComentario(conta: ContaMeta, comentarioId: string, oculto: boolean) {
  return chamar(`${comentarioId}?hide=${oculto}`, conta.token, {});
}

/** Nome e foto de quem escreveu, para a conversa não ficar só com um número. */
export async function perfilDoCliente(conta: ContaMeta, igId: string) {
  try {
    const d = await chamar(`${igId}?fields=name,username,profile_pic`, conta.token);
    return { nome: d?.name ?? null, usuario: d?.username ?? null, foto: d?.profile_pic ?? null };
  } catch {
    // Perfil é enfeite: se a Meta negar, a conversa funciona igual.
    return { nome: null, usuario: null, foto: null };
  }
}

/** Ainda dá para responder esta conversa? */
export function dentroDaJanela(respondeAte: string | null | undefined) {
  if (!respondeAte) return false;
  return new Date(respondeAte).getTime() > Date.now();
}

/** Quanto falta da janela, em texto curto para a tela. */
export function quantoFaltaDaJanela(respondeAte: string | null | undefined) {
  if (!respondeAte) return null;
  const ms = new Date(respondeAte).getTime() - Date.now();
  if (ms <= 0) return null;
  const horas = Math.floor(ms / 3600_000);
  if (horas >= 1) return `${horas}h para responder`;
  return `${Math.max(1, Math.floor(ms / 60_000))} min para responder`;
}

// --- Chamadas para os dois endereços da Meta --------------------------------
//
// O token do login unificado é de usuário do sistema e fala com
// graph.facebook.com usando o id da conta. Algumas rotas do Instagram, porém,
// só existem em graph.instagram.com (/me/...). Quando não se sabe qual dos dois
// responde, `tentar` passa pelos dois e devolve o primeiro que der certo,
// guardando o motivo de cada recusa para o diagnóstico.

const HOSTS = { fb: "https://graph.facebook.com", ig: "https://graph.instagram.com" } as const;
type Host = keyof typeof HOSTS;

export async function chamarNo(host: Host, caminho: string, token: string, corpo?: Record<string, unknown>, metodo?: string) {
  const sep = caminho.includes("?") ? "&" : "?";
  const url = `${HOSTS[host]}/${VERSAO}/${caminho}${sep}access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method: metodo ?? (corpo ? "POST" : "GET"),
    headers: corpo ? { "Content-Type": "application/json" } : undefined,
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await res.json().catch(() => ({}));
  if (!res.ok || dados?.error) throw new Error(dados?.error?.message ?? `Erro ${res.status} da Meta.`);
  return dados;
}

export async function tentar<T = any>(
  opcoes: { host: Host; caminho: string; corpo?: Record<string, unknown>; metodo?: string }[],
  token: string,
): Promise<{ ok: true; dados: T; via: string } | { ok: false; erros: string[] }> {
  const erros: string[] = [];
  for (const o of opcoes) {
    try {
      const dados = await chamarNo(o.host, o.caminho, token, o.corpo, o.metodo);
      return { ok: true, dados, via: `${o.host}:${o.caminho.split("?")[0]}` };
    } catch (e) {
      erros.push(`${o.host}:${o.caminho.split("?")[0]} → ${(e as Error).message}`);
    }
  }
  return { ok: false, erros };
}

/** Liga (ou religa) os avisos de mensagem, comentário e reação da conta. */
export async function ligarAvisos(conta: ContaMeta) {
  const campos = "messages,comments,message_reactions";
  const ig = conta.igUserId ?? "me";
  return tentar(
    [
      { host: "fb", caminho: `${ig}/subscribed_apps?subscribed_fields=${campos}`, metodo: "POST" },
      { host: "ig", caminho: `me/subscribed_apps?subscribed_fields=${campos}`, metodo: "POST" },
    ],
    conta.token,
  );
}
