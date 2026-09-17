// Pochi-Mine 軽量サービスワーカー（アプリシェルのオフライン対応）。
// 方針:
//  - /api/* は絶対にキャッシュしない（BYOK・AI・レート制限のため常にネットワーク）。
//  - 静的アセット(_next/static, icons, images, sound, animations)は cache-first＋背景更新。
//  - ページ遷移(HTML)は network-first、オフライン時はキャッシュ（無ければトップ）にフォールバック。
// ※ Turbopack と相性の悪いプラグインは使わず、手書きで最小構成にしている。
const CACHE = "pochi-mine-v1"
const ASSET_RE = /\/(?:_next\/static|icons|images|sound|animations|fonts)\//

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api/")) return // AI/プロキシは常にネットワーク

  if (ASSET_RE.test(url.pathname)) {
    event.respondWith(cacheFirst(req))
  } else if (req.mode === "navigate") {
    event.respondWith(networkFirst(req))
  }
})

async function cacheFirst(req) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(req)
  if (cached) {
    fetch(req)
      .then((res) => {
        if (res && res.ok) cache.put(req, res.clone())
      })
      .catch(() => {})
    return cached
  }
  const res = await fetch(req)
  if (res && res.ok) cache.put(req, res.clone())
  return res
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE)
  try {
    const res = await fetch(req)
    if (res && res.ok) cache.put(req, res.clone())
    return res
  } catch (e) {
    const cached = await cache.match(req)
    if (cached) return cached
    const home = await cache.match("/")
    if (home) return home
    throw e
  }
}
