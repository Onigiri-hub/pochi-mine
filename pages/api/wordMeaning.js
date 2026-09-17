// POST /api/wordMeaning
// 文脈中の単語の意味（チャットの単語タップ用・BYOK）。戻り: { meaning }
import { generateJSON } from "../../lib/llm"
import { checkRateLimit } from "../../lib/rateLimit"
import { sendProviderError } from "../../lib/apiError"

const PROVIDERS = ["claude", "openai", "gemini"]

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" })
  try {
    const rl = await checkRateLimit(req)
    if (!rl.success) return res.status(429).json({ error: "rate_limited", detail: "アクセスが集中しています。少し待ってね。" })

    const { provider, apiKey, model, word, sentence } = req.body || {}
    if (!PROVIDERS.includes(provider)) return res.status(400).json({ error: "invalid_provider" })
    if (!apiKey || !String(apiKey).trim()) return res.status(400).json({ error: "missing_api_key" })
    if (!word || !String(word).trim()) return res.status(400).json({ error: "empty_word" })

    const { json, usage } = await generateJSON({
      provider,
      apiKey,
      model,
      maxTokens: 160,
      prompt: `次の英文の中で使われている単語「${String(word).trim()}」の意味を、日本語で短く説明してください。品詞があれば先頭に付けて、文脈に合う意味だけでよいです。出力は次のJSON形式のみ（説明文なし）:
{"meaning":"…"}

英文: ${String(sentence || "").trim()}
単語: ${String(word).trim()}`,
    })
    const meaning = (json?.meaning || "").toString().trim()
    if (!meaning) return res.status(502).json({ error: "generation_failed" })
    return res.status(200).json({ meaning, usage })
  } catch (e) {
    return sendProviderError(res, e)
  }
}
