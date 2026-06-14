const SHELL_CACHE_PREFIX = "vuei-shell"
const SHELL_CACHE_VERSION = "20260613a"
const CACHE_NAME = `${SHELL_CACHE_PREFIX}-${SHELL_CACHE_VERSION}`
const SHELL_FALLBACK_URL = "/"
const SHELL_URLS = [
  SHELL_FALLBACK_URL,
  "/manifest.webmanifest?v=20260611b",
  "/favicon.ico",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/apple-touch-icon-20260611b.png",
  "/android-chrome-192x192-20260611b.png",
  "/android-chrome-512x512-20260611b.png",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).catch(() => undefined),
  )
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
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedShell = await caches.match(SHELL_FALLBACK_URL)
        if (cachedShell) {
          return cachedShell
        }

        return Response.error()
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
