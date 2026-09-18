// POST /api/translate
// 英文1文 → 日本語訳（チャットの▼和訳用・BYOK）。戻り: { ja }
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

    const { provider, apiKey, model, en, context } = req.body || {}
    if (!PROVIDERS.includes(provider)) return res.status(400).json({ error: "invalid_provider" })
    if (!apiKey || !String(apiKey).trim()) return res.status(400).json({ error: "missing_api_key" })
    if (!en || !String(en).trim()) return res.status(400).json({ error: "empty_text" })

    const ctx = formatChatContext(context)
    const { json, usage } = await generateJSON({
      provider,
      apiKey,
      model,
      maxTokens: 300,
      prompt: `${ctx ? `以下は英会話チャットの直近のやりとりです（文脈把握用。これ自体は訳さないこと）:\n${ctx}\n\n` : ""}上の流れを踏まえて、次の英文1文だけを自然な日本語に翻訳してください。代名詞や省略された内容は文脈から補い、その場面に合ったニュアンスにしてください。出力は次のJSON形式のみ（説明文なし）:
{"ja":"…"}

対象の英文: ${String(en).trim()}`,
    })
    const ja = (json?.ja || "").toString().trim()
    if (!ja) return res.status(502).json({ error: "generation_failed" })
    return res.status(200).json({ ja, usage })
  } catch (e) {
    return sendProviderError(res, e)
  }
}
