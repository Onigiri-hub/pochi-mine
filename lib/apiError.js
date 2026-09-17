// API Route 共通のエラー応答マッパー。
// lib/llm.js が付与した共通コードを、ユーザー向けメッセージ＋HTTPステータスへ変換する。
// ★ここでも apiKey / リクエストボディは絶対にログしない（code と message のみ）。

export function sendProviderError(res, e) {
  const code = e?.code
  if (code === "invalid_key") {
    return res.status(401).json({ error: "invalid_key", detail: "APIキーが正しくないようです。設定を確認してください。" })
  }
  if (code === "content_blocked") {
    return res.status(400).json({ error: "content_blocked", detail: "この内容では作成できませんでした。表現を見直してください。" })
  }
  if (code === "rate_limited") {
    return res.status(429).json({ error: "rate_limited", detail: "AI提供元のレート上限に達しました。少し時間をおいて、もう一度お試しください。" })
  }
  if (code === "unavailable") {
    return res.status(503).json({ error: "unavailable", detail: "現在AIサーバーが混み合っています。少し時間をおいて、もう一度お試しください。" })
  }
  console.error("[pochi-mine] provider error", { code, message: e?.message })
  return res.status(500).json({ error: "server_error" })
}
