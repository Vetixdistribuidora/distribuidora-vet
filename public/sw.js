const CACHE_DYNAMIC = "vetix-v7"
const CACHE_STATIC  = "vetix-static-v7"

// ── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_DYNAMIC)
      .then((c) => c.addAll(["/"])) // precache only the shell
      .then(() => self.skipWaiting()) // activate immediately, don't wait
  )
})

// ── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_DYNAMIC && k !== CACHE_STATIC)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
      .then(() => {
        // Tell every open tab: "new SW is live, please reload"
        return self.clients.matchAll({ type: "window" }).then((clients) => {
          clients.forEach((client) =>
            client.postMessage({ type: "SW_UPDATED" })
          )
        })
      })
  )
})

// ── FETCH ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return
  const url = new URL(e.request.url)
  if (url.origin !== location.origin) return

  // 1. Navigation (HTML pages): always network-first, never serve stale HTML
  //    → user always gets fresh app shell after a Vercel deploy
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(() => caches.match("/"))
    )
    return
  }

  // 2. Next.js hashed static chunks (_next/static/…):
  //    safe to cache forever — filenames change on each deploy
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached
        return fetch(e.request).then((res) => {
          if (res && res.status === 200) {
            caches.open(CACHE_STATIC).then((c) => c.put(e.request, res.clone()))
          }
          return res
        })
      })
    )
    return
  }

  // 3. Everything else (images, fonts, icons): network-first, cache as fallback
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone()
          caches.open(CACHE_DYNAMIC).then((c) => c.put(e.request, clone))
        }
        return res
      })
      .catch(() =>
        caches.match(e.request).then((r) => r || caches.match("/"))
      )
  )
})

// ── MESSAGES ─────────────────────────────────────────────────────────────────
self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") self.skipWaiting()
})
