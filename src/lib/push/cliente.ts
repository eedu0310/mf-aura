"use client";

/**
 * Lado do aparelho das notificações push (ver src/lib/push/servidor.ts).
 *
 * O aviso só toca com o AURA fechado se o service worker (/sw.js) estiver
 * registrado — ele é quem recebe o push e mostra a notificação.
 */

export type EstadoPush =
  | "carregando"
  | "sem_suporte" // navegador sem push
  | "iphone_sem_app" // iPhone/iPad fora do app da tela de início
  | "bloqueado" // a pessoa negou a permissão
  | "desligado"
  | "ligado";

function ehIos() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function abertoComoApp() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function temSuporte() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registro(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  const atual = await navigator.serviceWorker.getRegistration("/");
  if (atual) return atual;
  // Em produção o PwaRegister já registrou; aqui é só garantia.
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  } catch {
    return null;
  }
}

export async function estadoDoPush(): Promise<EstadoPush> {
  if (!temSuporte()) return ehIos() && !abertoComoApp() ? "iphone_sem_app" : "sem_suporte";
  if (Notification.permission === "denied") return "bloqueado";
  const reg = await registro();
  if (!reg) return "sem_suporte";
  const inscricao = await reg.pushManager.getSubscription();
  return inscricao && Notification.permission === "granted" ? "ligado" : "desligado";
}

function chaveEmBytes(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const bruto = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

async function gravarNoServidor(inscricao: PushSubscription) {
  const r = await fetch("/api/push/inscricao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(inscricao.toJSON()),
  });
  if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { erro?: string }).erro ?? "Não deu para ligar os avisos.");
}

/** Pede a permissão e inscreve este aparelho. Tem que ser chamado num clique. */
export async function ligarPush(): Promise<EstadoPush> {
  if (!temSuporte()) return ehIos() && !abertoComoApp() ? "iphone_sem_app" : "sem_suporte";
  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") return permissao === "denied" ? "bloqueado" : "desligado";

  const reg = await registro();
  if (!reg) throw new Error("Este navegador não deixou o AURA instalar o serviço de avisos.");
  await navigator.serviceWorker.ready;

  const r = await fetch("/api/push/inscricao");
  const corpo = (await r.json().catch(() => ({}))) as { chave?: string; erro?: string };
  if (!r.ok || !corpo.chave) throw new Error(corpo.erro ?? "As notificações ainda não estão liberadas no servidor.");

  let inscricao = await reg.pushManager.getSubscription();
  // Inscrição feita com outra chave (servidor trocou as chaves): refaz.
  const chaveAtual = inscricao?.options.applicationServerKey;
  if (inscricao && chaveAtual) {
    const atual = btoa(String.fromCharCode(...new Uint8Array(chaveAtual))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    if (atual !== corpo.chave.replace(/=+$/, "")) {
      await inscricao.unsubscribe().catch(() => {});
      inscricao = null;
    }
  }
  inscricao ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveEmBytes(corpo.chave) });
  await gravarNoServidor(inscricao);
  return "ligado";
}

/** Desliga só neste aparelho. */
export async function desligarPush(): Promise<EstadoPush> {
  const reg = await registro();
  const inscricao = await reg?.pushManager.getSubscription();
  if (inscricao) {
    await fetch("/api/push/inscricao", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: inscricao.endpoint }),
    }).catch(() => {});
    await inscricao.unsubscribe().catch(() => {});
  }
  return "desligado";
}

export async function mandarTeste(): Promise<void> {
  const r = await fetch("/api/push/teste", { method: "POST" });
  if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { erro?: string }).erro ?? "O teste não saiu.");
}

let sincronizado = false;

/**
 * Uma vez por carregamento: se este aparelho já está inscrito, confirma no
 * servidor que ele é de quem está logado agora. Cobre troca de login no mesmo
 * celular e inscrição que o servidor tinha apagado.
 */
export function sincronizarPush() {
  if (sincronizado || typeof window === "undefined" || !temSuporte()) return;
  sincronizado = true;
  if (Notification.permission !== "granted") return;
  void navigator.serviceWorker
    .getRegistration("/")
    .then((reg) => reg?.pushManager.getSubscription())
    .then((inscricao) => (inscricao ? gravarNoServidor(inscricao) : undefined))
    .catch(() => {});
}

/**
 * Ao sair da conta: o servidor esquece este aparelho (a inscrição no navegador
 * fica, e volta a valer para quem entrar depois). Nunca segura o "Sair".
 */
export async function esquecerAparelho() {
  try {
    if (!temSuporte()) return;
    const reg = await navigator.serviceWorker.getRegistration("/");
    const inscricao = await reg?.pushManager.getSubscription();
    if (!inscricao) return;
    sincronizado = false;
    const controle = new AbortController();
    const t = setTimeout(() => controle.abort(), 2500);
    await fetch("/api/push/inscricao", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: inscricao.endpoint }),
      signal: controle.signal,
    }).catch(() => {});
    clearTimeout(t);
  } catch {
    /* sair da conta nunca depende disto */
  }
}
