/**
 * Rede resiliente: as chamadas do navegador para /api/ aguentam o servidor
 * reiniciando.
 *
 * O problema: a cada atualização do sistema (deploy automático) o serviço
 * reinicia por alguns segundos. Quem estava com a tela aberta via "AURA
 * indisponível — Failed to fetch", ou "Unexpected token '<'" (a página de
 * erro 502 do nginx lida como se fosse JSON). Eram mais de 60 telas com o
 * mesmo `await res.json()` e a mensagem crua do navegador na tela.
 *
 * A correção, num lugar só: o fetch do navegador passa por aqui.
 *   - GET/HEAD para /api/ do próprio sistema: se a rede falhar ou o servidor
 *     responder 502/503/504, tenta de novo (até 3 vezes: 1 s, 2 s, 4 s).
 *     Só GET, porque repetir um POST poderia gravar duas vezes.
 *   - Resposta 502/503/504 que não é JSON vira um JSON com { error } em
 *     português, e a tela mostra a mensagem dela em vez de quebrar no parse.
 *   - Falha de rede que sobrar vira um erro com mensagem em português.
 *
 * Chamadas para fora (Supabase, Meta...) passam direto, sem mudança.
 *
 * VELOCIDADE: GET igual a outro que ainda está a caminho não sai de novo —
 * pega carona na mesma resposta (cada tela recebe a sua cópia). No Meu Dia a
 * supervisão da AURA era pedida três vezes ao abrir (o cartão, o sino e o
 * resumo), e cada pedido refazia as contas no servidor.
 */

const MSG_REDE = "Sem conexão com o servidor da AURA. Confira a internet; se estiver ok, o sistema pode estar atualizando — tente de novo em alguns segundos.";
const MSG_REINICIANDO = "O sistema está atualizando. Tente de novo em alguns segundos.";
const ESPERAS_MS = [1000, 2000, 4000];

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

function ehDoSistema(url: URL) {
  return url.origin === window.location.origin && url.pathname.startsWith("/api/");
}

function urlDe(entrada: RequestInfo | URL): URL | null {
  try {
    const bruta = typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
    return new URL(bruta, window.location.href);
  } catch {
    return null;
  }
}

function respostaReiniciando(status: number) {
  return new Response(JSON.stringify({ error: MSG_REINICIANDO, erro: MSG_REINICIANDO }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

const instabilidade = (s: number) => s === 502 || s === 503 || s === 504;

/** GETs a caminho, por endereço: quem pedir o mesmo enquanto isso espera junto. */
const aCaminho = new Map<string, Promise<Response>>();

export function instalarRedeResiliente() {
  if (typeof window === "undefined") return;
  const w = window as Window & { __auraRedeResiliente?: boolean };
  if (w.__auraRedeResiliente) return;
  w.__auraRedeResiliente = true;

  const original = window.fetch.bind(window);

  window.fetch = async (entrada: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = urlDe(entrada);
    if (!url || !ehDoSistema(url)) return original(entrada, init);

    const metodo = (init?.method ?? (entrada instanceof Request ? entrada.method : "GET")).toUpperCase();
    const podeRepetir = (metodo === "GET" || metodo === "HEAD") && !(entrada instanceof Request && entrada.body);

    // Carona: só GET simples (sem cancelamento próprio, sem cabeçalho que mude
    // a resposta). Cada um recebe um clone, porque o corpo só se lê uma vez.
    const simples = metodo === "GET" && !(entrada instanceof Request) && !init?.signal && !init?.headers;
    if (simples) {
      const chave = url.href;
      let pedido = aCaminho.get(chave);
      if (!pedido) {
        pedido = buscar(entrada, init, true).finally(() => aCaminho.delete(chave));
        aCaminho.set(chave, pedido);
      }
      return pedido.then((r) => r.clone());
    }
    return buscar(entrada, init, podeRepetir);
  };

  async function buscar(entrada: RequestInfo | URL, init: RequestInit | undefined, podeRepetir: boolean): Promise<Response> {

    for (let tentativa = 0; ; tentativa++) {
      const sinal = init?.signal ?? (entrada instanceof Request ? entrada.signal : undefined);
      try {
        const res = await original(entrada, init);
        if (instabilidade(res.status) && podeRepetir && tentativa < ESPERAS_MS.length && !sinal?.aborted) {
          await esperar(ESPERAS_MS[tentativa]);
          continue;
        }
        if (instabilidade(res.status) && !(res.headers.get("content-type") ?? "").includes("json")) {
          return respostaReiniciando(res.status);
        }
        return res;
      } catch (e) {
        // Cancelamento de propósito (AbortController): devolve como veio.
        if (sinal?.aborted || (e instanceof DOMException && e.name === "AbortError")) throw e;
        if (podeRepetir && tentativa < ESPERAS_MS.length) {
          await esperar(ESPERAS_MS[tentativa]);
          continue;
        }
        throw new TypeError(MSG_REDE);
      }
    }
  }
}
