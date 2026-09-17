// 簡易レート制限（IP単位・スライディングウィンドウ）。
// 守る対象は「Vercelの計算枠」だけ（AI課金はユーザー自身のキー持ち）なので緩めでよい。
//
// Upstash Redis（環境変数）が未設定なら自動で「無効（常に許可）」にフォールバックする。
// → ローカル開発では何も設定せず動かせる。本番Vercelでは env を設定する。

let limiterPromise = null

async function getLimiter() {
  if (limiterPromise) return limiterPromise
  limiterPromise = (async () => {
    // env名は2系統に対応:
    //  - 手動設定/従来: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
    //  - Vercel Marketplace(Upstash for Redis)自動注入: KV_REST_API_URL / KV_REST_API_TOKEN
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
    if (!url || !token) return null // 未設定 → 無効

    const { Ratelimit } = await import("@upstash/ratelimit")
    const { Redis } = await import("@upstash/redis")
    const redis = new Redis({ url, token })
    return new Ratelimit({
      redis,
      prefix: "pochi-mine",
      limiter: Ratelimit.slidingWindow(
        Number(process.env.RATE_LIMIT_MAX || 20),
        `${Number(process.env.RATE_LIMIT_WINDOW_SEC || 60)} s`
      ),
    })
  })()
  return limiterPromise
}

// リバースプロキシ（Vercel）越しの実クライアントIPを取り出す。
export function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"]
  if (xff) return String(xff).split(",")[0].trim()
  return req.socket?.remoteAddress || "unknown"
}

// 戻り値: { success, remaining, reset, enabled }
// 未設定時は enabled:false・success:true（常に許可）。
export async function checkRateLimit(req) {
  const limiter = await getLimiter()
  if (!limiter) return { success: true, remaining: Infinity, reset: 0, enabled: false }
  const ip = getClientIp(req)
  const r = await limiter.limit(ip)
  return { success: r.success, remaining: r.remaining, reset: r.reset, enabled: true }
}
