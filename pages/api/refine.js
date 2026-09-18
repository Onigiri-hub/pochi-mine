// POST /api/refine
// チャットでユーザーが書いた文を「自然な英語」に変換（BYOK）。
// 日本語なら英訳、英語なら文法的に正しい自然な英語に直す。戻り: { en }
import { generateJSON } from "../../lib/llm"
import { checkRateLimit } from "../../lib/rateLimit"
import { sendProviderError } from "../../lib/apiError"
import { formatChatContext } from "../../lib/chatContext"

const PROVIDERS = ["claude", "openai", "gemini"]

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" })
  try {
    const rl = await checkRateLimit(req)
    if (!rl.success) return res.status(429).json({ error: "rate_limited", detail: "アクセスが集中しています。少し待ってね。" })

    const { provider, apiKey, model, text, context } = req.body || {}
    if (!PROVIDERS.includes(provider)) return res.status(400).json({ error: "invalid_provider" })
    if (!apiKey || !String(apiKey).trim()) return res.status(400).json({ error: "missing_api_key" })
    if (!text || !String(text).trim()) return res.status(400).json({ error: "empty_text" })

    const ctx = formatChatContext(context)
    const { json, usage } = await generateJSON({
      provider,
      apiKey,
      model,
      maxTokens: 300,
      prompt: `次の文は、英会話アプリのチャットでユーザーが書いたメッセージです。これを自然でやさしい話し言葉の英語に直してください。
- 日本語なら英語に翻訳する。
- すでに英語なら、文法的に正しく自然な英語に書き直す（意味は変えない）。
- 主語や指示語が省略されていれば、下の会話の流れから補って自然な英語にする。
${ctx ? `\n直近のやりとり（文脈把握用。これ自体は訳さないこと）:\n${ctx}\n` : ""}
上の流れを踏まえ、対象メッセージだけを英語にしてください。出力は次のJSON形式のみ（説明文なし）:
{"en":"…"}

対象メッセージ: ${String(text).trim()}`,
    })
    const en = (json?.en || "").toString().trim()
    if (!en) return res.status(502).json({ error: "generation_failed" })
    return res.status(200).json({ en, usage })
  } catch (e) {
    return sendProviderError(res, e)
  }
}
