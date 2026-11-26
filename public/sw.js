/*
 * Service worker do AURA (o que permite "instalar" o app no celular).
 *
 * v3, 21/10: a versão anterior guardava em cache, para sempre, tudo o que não
 * fosse /api ou /_next — inclusive os pedaços de página que o Next busca ao
 * trocar de tela (?_rsc=...). Quem deixava o AURA aberto continuava vendo
 * telas de várias versões atrás mesmo depois do deploy; foi o que aconteceu
 * no MacBook do Alexandre.
 *
 * Agora só ícones, imagens, fontes e o manifest ficam em cache. Página e dado
 * sempre vêm do servidor. Trocar o nome do cache apaga o cache velho de quem
 * já tinha o service worker antigo.
 */
const CACHE_NAME = "aura-estatico-v3";
// v4, 26/11: + notificações push (fim do arquivo).

const EXTENSOES_ESTATICAS = /\.(png|jpe?g|svg|ico|webp|gif|woff2?|ttf|webmanifest)$/i;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Abrir uma página: sempre do servidor. Sem internet, um aviso simples.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response("Sem conexão. O AURA volta assim que a internet voltar.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          }),
      ),
    );
    return;
  }

  // Só arquivo estático de verdade vai para o cache. Todo o resto (pedaços de
  // página do Next, /api, /_next) segue direto, sem o service worker no meio.
  if (!EXTENSOES_ESTATICAS.test(url.pathname) || url.search) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});

/*
 * Notificações push (migração 117). O servidor manda {titulo, mensagem, url,
 * tag}; aqui vira a notificação do aparelho. Tocar nela abre a tela do aviso
 * no AURA que já estiver aberto, ou abre um novo.
 */
self.addEventListener("push", (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = { mensagem: event.data ? event.data.text() : "" };
  }
  const titulo = dados.titulo || "AURA";
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.mensagem || "",
      icon: "/icons/aura-192.png",
      badge: "/icons/aura-maskable-192.png",
      tag: dados.tag || undefined,
      data: { url: dados.url || "/meu-dia" },
      lang: "pt-BR",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let destino;
  try {
    destino = new URL((event.notification.data && event.notification.data.url) || "/meu-dia", self.location.origin);
    if (destino.origin !== self.location.origin) destino = new URL("/meu-dia", self.location.origin);
  } catch {
    destino = new URL("/meu-dia", self.location.origin);
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if (new URL(janela.url).origin === self.location.origin && "focus" in janela) {
          return janela.focus().then((j) => (j && "navigate" in j ? j.navigate(destino.href) : j));
        }
      }
      return self.clients.openWindow(destino.href);
    }),
  );
});

// O navegador trocou a inscrição sozinho (raro): grava a nova para quem está
// logado neste aparelho. Sem login, fica para o próximo carregamento do AURA.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    fetch("/api/push/inscricao", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("sem login"))))
      .then(({ chave }) => {
        const padding = "=".repeat((4 - (chave.length % 4)) % 4);
        const bruto = atob((chave + padding).replace(/-/g, "+").replace(/_/g, "/"));
        const bytes = Uint8Array.from(bruto, (c) => c.charCodeAt(0));
        return self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
      })
      .then((inscricao) =>
        fetch("/api/push/inscricao", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(inscricao.toJSON()),
        }),
      )
      .catch(() => {}),
  );
});
