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

/**
 * Manda qualquer coisa para o direct (texto, foto, áudio, reação).
 *
 * Com o login unificado a Meta às vezes só aceita o envio pela Página do
 * Facebook ligada ao Instagram (com o token da Página); por isso tenta a
 * conta, depois a Página, depois o endereço do Instagram.
 */
async function mandarNoDirect(conta: ContaMeta, corpo: Record<string, unknown>) {
  const alvo = conta.igUserId || "me";
  const pagina = await paginaDaConta(conta);
  const opcoes: Opcao[] = [{ host: "fb", caminho: `${alvo}/messages`, corpo }];
  if (pagina.ok) opcoes.push({ host: "fb", caminho: `${pagina.id}/messages`, corpo, token: pagina.token });
  opcoes.push({ host: "ig", caminho: "me/messages", corpo });
  const r = await tentar<{ message_id?: string; recipient_id?: string }>(opcoes, conta.token);
  if (!r.ok) throw new Error(r.erros[r.erros.length - 1]?.split(" → ").pop() ?? "A Meta recusou o envio.");
  return r.dados;
}

/** Responde uma DM com texto. Devolve o id da mensagem na Meta. */
export async function enviarMensagem(conta: ContaMeta, destinatario: string, texto: string) {
  return mandarNoDirect(conta, { recipient: { id: destinatario }, message: { text: texto } });
}

/** Foto, vídeo ou áudio por um endereço público (a Meta baixa o arquivo). */
export async function enviarMidia(
  conta: ContaMeta,
  destinatario: string,
  tipo: "image" | "audio" | "video",
  url: string,
) {
  return mandarNoDirect(conta, {
    recipient: { id: destinatario },
    message: { attachment: { type: tipo, payload: { url } } },
  });
}

/** Coração numa mensagem do cliente (a API do Instagram só aceita "love"). */
export async function reagirMensagem(conta: ContaMeta, destinatario: string, mid: string, ligar: boolean) {
  return mandarNoDirect(conta, {
    recipient: { id: destinatario },
    sender_action: ligar ? "react" : "unreact",
    payload: { message_id: mid, ...(ligar ? { reaction: "love" } : {}) },
  });
}

/**
 * Resposta privada a um comentário: abre o direct com quem comentou.
 * A Meta deixa uma por comentário, em até 7 dias.
 */
export async function responderNoPrivado(conta: ContaMeta, comentarioId: string, texto: string) {
  return mandarNoDirect(conta, { recipient: { comment_id: comentarioId }, message: { text: texto } });
}

/** Responde um comentário de publicação, em público. */
export async function responderComentario(conta: ContaMeta, comentarioId: string, texto: string) {
  const r = await tentar(
    [
      { host: "fb", caminho: `${comentarioId}/replies`, corpo: { message: texto } },
      { host: "ig", caminho: `${comentarioId}/replies`, corpo: { message: texto } },
    ],
    conta.token,
  );
  if (!r.ok) throw new Error(r.erros[r.erros.length - 1]?.split(" → ").pop() ?? "A Meta recusou a resposta.");
  return r.dados;
}

/** Esconde ou mostra um comentário. */
export async function ocultarComentario(conta: ContaMeta, comentarioId: string, oculto: boolean) {
  const r = await tentar(
    [
      { host: "fb", caminho: `${comentarioId}?hide=${oculto}`, metodo: "POST" },
      { host: "ig", caminho: `${comentarioId}?hide=${oculto}`, metodo: "POST" },
    ],
    conta.token,
  );
  if (!r.ok) throw new Error(r.erros[r.erros.length - 1]?.split(" → ").pop() ?? "A Meta recusou.");
  return r.dados;
}

/** Apaga um comentário da publicação (não tem volta). */
export async function apagarComentario(conta: ContaMeta, comentarioId: string) {
  const r = await tentar(
    [
      { host: "fb", caminho: comentarioId, metodo: "DELETE" },
      { host: "ig", caminho: comentarioId, metodo: "DELETE" },
    ],
    conta.token,
  );
  if (!r.ok) throw new Error(r.erros[r.erros.length - 1]?.split(" → ").pop() ?? "A Meta recusou.");
  return r.dados;
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

export interface Opcao {
  host: Host;
  caminho: string;
  corpo?: Record<string, unknown>;
  metodo?: string;
  /** Token próprio desta tentativa (ex.: o da Página); sem ele vale o da conta. */
  token?: string;
}

export async function tentar<T = any>(
  opcoes: Opcao[],
  token: string,
): Promise<{ ok: true; dados: T; via: string } | { ok: false; erros: string[] }> {
  const erros: string[] = [];
  for (const o of opcoes) {
    try {
      const dados = await chamarNo(o.host, o.caminho, o.token ?? token, o.corpo, o.metodo);
      return { ok: true, dados, via: `${o.host}:${o.caminho.split("?")[0]}${o.token ? " (Página)" : ""}` };
    } catch (e) {
      erros.push(`${o.host}:${o.caminho.split("?")[0]}${o.token ? " (Página)" : ""} → ${(e as Error).message}`);
    }
  }
  return { ok: false, erros };
}

// --- Página do Facebook ligada ao Instagram ---------------------------------
//
// Pelo login do Facebook, as DMs do Instagram passam pela Página ligada à
// conta: listar conversas, assinar os avisos de mensagem e responder pedem o
// id e o token da Página. O token da conta busca a Página uma vez por hora.

type Pagina = { ok: true; id: string; nome: string | null; token: string } | { ok: false; erros: string[] };
const paginas = new Map<string, { em: number; pagina: Pagina }>();

export async function paginaDaConta(conta: ContaMeta): Promise<Pagina> {
  const guardada = paginas.get(conta.id);
  if (guardada && Date.now() - guardada.em < 3600_000) return guardada.pagina;

  const erros: string[] = [];
  let pagina: Pagina | null = null;
  try {
    const r = await chamarNo(
      "fb",
      "me/accounts?fields=id,name,access_token,instagram_business_account{id}&limit=100",
      conta.token,
    );
    const lista: any[] = r?.data ?? [];
    const achada =
      lista.find((p) => String(p.instagram_business_account?.id ?? "") === String(conta.igUserId ?? "")) ??
      (lista.length === 1 ? lista[0] : null);
    if (achada?.access_token) {
      pagina = { ok: true, id: String(achada.id), nome: achada.name ?? null, token: String(achada.access_token) };
    } else {
      erros.push(
        lista.length
          ? `me/accounts → ${lista.length} Página(s) liberada(s), nenhuma ligada a este Instagram`
          : "me/accounts → nenhuma Página do Facebook liberada para o AURA",
      );
    }
  } catch (e) {
    erros.push(`me/accounts → ${(e as Error).message}`);
  }
  const final: Pagina = pagina ?? { ok: false, erros };
  paginas.set(conta.id, { em: Date.now(), pagina: final });
  return final;
}

/**
 * Liga (ou religa) os avisos de mensagem, comentário e reação da conta.
 * Assina pela Página (é o que faz as DMs chegarem pelo login do Facebook) e
 * pela conta do Instagram; basta um dos dois aceitar.
 */
export async function ligarAvisos(conta: ContaMeta) {
  const campos = "messages,comments,message_reactions";
  const ig = conta.igUserId ?? "me";
  const pagina = await paginaDaConta(conta);
  const etapas: string[] = [];
  let algumOk = false;
  let via = "";

  if (pagina.ok) {
    const r = await tentar(
      [
        { host: "fb", caminho: `${pagina.id}/subscribed_apps?subscribed_fields=messages,feed`, metodo: "POST", token: pagina.token },
        { host: "fb", caminho: `${pagina.id}/subscribed_apps?subscribed_fields=feed`, metodo: "POST", token: pagina.token },
      ],
      conta.token,
    );
    if (r.ok) {
      algumOk = true;
      via = r.via;
      etapas.push(`Página ${pagina.nome ?? pagina.id}: assinada`);
    } else etapas.push(...r.erros);
  } else etapas.push(...pagina.erros);

  const r2 = await tentar(
    [
      { host: "fb", caminho: `${ig}/subscribed_apps?subscribed_fields=${campos}`, metodo: "POST" },
      { host: "ig", caminho: `me/subscribed_apps?subscribed_fields=${campos}`, metodo: "POST" },
    ],
    conta.token,
  );
  if (r2.ok) {
    algumOk = true;
    via = via ? `${via} + ${r2.via}` : r2.via;
    etapas.push("Instagram: assinado");
  } else etapas.push(...r2.erros);

  return algumOk
    ? { ok: true as const, via, dados: { etapas } }
    : { ok: false as const, erros: etapas };
}
