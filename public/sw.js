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
