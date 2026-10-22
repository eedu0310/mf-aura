/**
 * /limpar — destrava um navegador preso numa versão antiga do AURA.
 *
 * Por quê: em 21/10 o MacBook do Alexandre continuou mostrando telas de
 * várias versões atrás mesmo depois de recarregar. Isso vem do que o
 * navegador guardou (o service worker antigo e o cache dele), que o servidor
 * não alcança — a não ser pedindo ao próprio navegador que apague.
 *
 * O cabeçalho Clear-Site-Data faz exatamente isso: o navegador apaga o cache
 * e o armazenamento deste site (inclui o service worker). Os cookies ficam,
 * então normalmente a pessoa continua logada; se não, é só entrar de novo.
 *
 * Basta abrir crm.mflaser.com.br/limpar. A página volta sozinha para o
 * início em seguida.
 */
export const dynamic = "force-dynamic";

const PAGINA = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Atualizando o AURA</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
         font-family: system-ui, -apple-system, sans-serif; background: #0b1f2a; color: #fff; }
  .caixa { text-align: center; padding: 24px; }
  p { color: #b7c4cc; }
</style>
</head>
<body>
  <div class="caixa">
    <h1>Atualizando o AURA…</h1>
    <p id="msg">Apagando a versão antiga guardada neste navegador.</p>
  </div>
<script>
  (async function () {
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ("caches" in window) {
        const nomes = await caches.keys();
        await Promise.all(nomes.map((n) => caches.delete(n)));
      }
    } catch (e) {}
    document.getElementById("msg").textContent = "Pronto. Abrindo a versão nova…";
    setTimeout(function () { window.location.replace("/?v=" + Date.now()); }, 1200);
  })();
</script>
</body>
</html>`;

export function GET() {
  return new Response(PAGINA, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      // Cache e armazenamento (inclui o service worker). Cookies não: a
      // pessoa continua logada.
      "Clear-Site-Data": '"cache", "storage"',
    },
  });
}
