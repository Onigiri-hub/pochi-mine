// POST /api/refine
// チャットでユーザーが書いた文を「自然な英語」に変換（BYOK）。
// 日本語なら英訳、英語なら文法的に正しい自然な英語に直す。戻り: { en }
import { generateJSON } from "../../lib/llm"
import { checkRateLimit } from "../../lib/rateLimit"
import { sendProviderError } from "../../lib/apiError"

const PROVIDERS = ["claude", "openai", "gemini"]

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" })
  try {
    const rl = await checkRateLimit(req)
    if (!rl.success) return res.status(429).json({ error: "rate_limited", detail: "アクセスが集中しています。少し待ってね。" })

    const { provider, apiKey, model, text } = req.body || {}
    if (!PROVIDERS.includes(provider)) return res.status(400).json({ error: "invalid_provider" })
    if (!apiKey || !String(apiKey).trim()) return res.status(400).json({ error: "missing_api_key" })
    if (!text || !String(text).trim()) return res.status(400).json({ error: "empty_text" })

    const { json, usage } = await generateJSON({
      provider,
      apiKey,
      model,
      maxTokens: 300,
      prompt: `次の文は、英会話アプリのチャットでユーザーが書いたメッセージです。これを自然でやさしい英語に直してください。
- 日本語なら英語に翻訳する。
- すでに英語なら、文法的に正しく自然な英語に書き直す（意味は変えない）。
話し言葉のカジュアルな会話文にしてください。出力は次のJSON形式のみ（説明文なし）:
{"en":"…"}

メッセージ: ${String(text).trim()}`,
    })
    const en = (json?.en || "").toString().trim()
    if (!en) return res.status(502).json({ error: "generation_failed" })
    return res.status(200).json({ en, usage })
  } catch (e) {
    return sendProviderError(res, e)
  }
}
