// POST /api/chat（ストリーミング）
// ユーザーは主に日本語で話しかける → AIは短くやさしい英語で返す（BYOK）。
// 返答はテキストとして逐次ストリームする。末尾に使用トークンをマーカー付きで載せる。
// キーは保存もログもしない。
//
// リクエストbody: { provider, apiKey, model?, messages:[{role,content}], difficulty?, tone? }

import { streamChat } from "../../lib/llm"
import { buildEnglishStyle } from "../../lib/difficulty"
import { checkRateLimit } from "../../lib/rateLimit"
import { sendProviderError } from "../../lib/apiError"

const PROVIDERS = ["claude", "openai", "gemini"]
const MAX_MESSAGES = 24 // 直近だけ送る（コンテキスト肥大＝トークン浪費を防ぐ）
// ストリーム末尾に使用トークンを載せるための区切り（英語の返答本文には現れない）
export const USAGE_MARKER = "\n[[USAGE]]"

function buildSystem(difficulty, tone) {
  const style = buildEnglishStyle(difficulty, tone)
  return `You are Pochi, a warm and friendly English conversation partner for a Japanese person who is a beginner at English.
The user will usually write in Japanese. Understand it, and keep a natural, friendly conversation going.
Rules:
- Reply in English only. Never write Japanese.
- Keep it simple and short: 1 to 3 short sentences, each about 6 to 12 words.
- Always end your reply with one easy question to keep the conversation going.
- Do not correct the user's mistakes. Just chat warmly and encourage them.
- Style: ${style}`
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" })
  }

  try {
    const rl = await checkRateLimit(req)
    if (!rl.success) {
      return res.status(429).json({ error: "rate_limited", detail: "アクセスが集中しています。少し時間をおいて、もう一度お試しください。" })
    }

    const { provider, apiKey, model, messages, difficulty, tone } = req.body || {}
    if (!PROVIDERS.includes(provider)) return res.status(400).json({ error: "invalid_provider" })
    if (!apiKey || !String(apiKey).trim()) return res.status(400).json({ error: "missing_api_key" })
    if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: "empty_messages" })

    const trimmed = messages.slice(-MAX_MESSAGES).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || ""),
    }))

    let started = false
    const ensureHeaders = () => {
      if (started) return
      started = true
      res.setHeader("Content-Type", "text/plain; charset=utf-8")
      res.setHeader("Cache-Control", "no-cache, no-transform")
      res.setHeader("X-Accel-Buffering", "no")
    }

    const result = await streamChat({
      provider,
      apiKey,
      model,
      system: buildSystem(difficulty, tone),
      messages: trimmed,
      maxTokens: 400,
      onDelta: (t) => {
        ensureHeaders()
        res.write(t)
      },
    })

    // 使用トークンを末尾マーカーで送る（クライアントが分離して集計）
    if (result?.usage) {
      ensureHeaders()
      res.write(USAGE_MARKER + JSON.stringify(result.usage))
    }
    res.end()
  } catch (e) {
    if (!res.headersSent) return sendProviderError(res, e)
    try {
      res.end()
    } catch {}
  }
}
