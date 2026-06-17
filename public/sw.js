const SHELL_CACHE_PREFIX = "vuei-shell"
const SHELL_CACHE_VERSION = "20260617c"
const CACHE_NAME = `${SHELL_CACHE_PREFIX}-${SHELL_CACHE_VERSION}`
const SHELL_FALLBACK_URL = "/"
const SHELL_URLS = [
  SHELL_FALLBACK_URL,
  "/manifest.webmanifest?v=20260617c",
  "/favicon.ico",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/apple-touch-icon-20260611b.png?v=20260617c",
  "/android-chrome-192x192-20260611b.png?v=20260617c",
  "/android-chrome-512x512-20260611b.png?v=20260617c",
]

function createTripOfflineFallbackResponse() {
  return new Response(
    `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Vuei Offline</title>
    <style>
      body{margin:0;background:#000;color:#fff;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      main{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
      .card{max-width:420px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.02);border-radius:24px;padding:28px;text-align:center}
      h1{font-size:22px;margin:0 0 12px}
      p{margin:0;color:rgba(255,255,255,.62);line-height:1.5}
    </style>
  </head>
  <body>
    <main>
      <div class="card">
        <h1>Esta viagem nao foi salva para uso offline neste dispositivo.</h1>
        <p>Abra este link com internet e toque em Salvar Offline para preparar o acesso sem conexao.</p>
      </div>
    </main>
  </body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  )
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).catch(() => undefined),
  )
  void self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith(`${SHELL_CACHE_PREFIX}-`) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  )
  void self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  const url = new URL(request.url)

  if (request.method !== "GET") return
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api/")) return
  if (url.searchParams.has("adminToken")) return
  if (url.searchParams.has("token")) return
  if (url.searchParams.has("publicToken")) return

  if (request.mode === "navigate") {
    const isTripRoute =
      url.pathname.startsWith("/v/") ||
      url.pathname.startsWith("/viagem/")

    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response && response.ok) {
            const responseClone = response.clone()
            void caches.open(CACHE_NAME).then((cache) => cache.put(url.pathname, responseClone))
          }

          return response
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME)
          const cachedNavigation = await cache.match(url.pathname)
          if (cachedNavigation) {
            return cachedNavigation
          }

          if (!isTripRoute) {
            const cachedShell = await caches.match(SHELL_FALLBACK_URL)
            if (cachedShell) {
              return cachedShell
            }

            return Response.error()
          }

          return createTripOfflineFallbackResponse()
        }),
    )
    return
  }

  const isStaticAsset =
    url.pathname.startsWith("/_next/") ||
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font"

  if (!isStaticAsset) return

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkPromise = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const responseClone = response.clone()
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone))
          }
          return response
        })
        .catch(() => cachedResponse)

      if (cachedResponse) {
        void networkPromise
        return cachedResponse
      }

      return networkPromise
    }),
  )
})
