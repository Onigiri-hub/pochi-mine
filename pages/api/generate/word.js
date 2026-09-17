// POST /api/generate/word
// 単語1つ → 例文(en)＋和訳(ja) を count 個生成する（BYOK）。
// 返すのは { word, sentences:[{en,ja}] } の最小形。
//   answer / chips / id / audio はクライアント側で付与する（データ設計どおり）。
//
// リクエストbody: { provider, apiKey, word, count(1〜4), level?, model? }
//   level = { levelMode, cefrLevel, grammarLevel }（生成英語のレベル）
//   ※ apiKey は保存もログもしない。生成のたびに受け取り、使い捨てる。

import { generateJSON } from "../../../lib/llm"
import { buildLevelInstruction } from "../../../lib/difficulty"
import { checkRateLimit } from "../../../lib/rateLimit"
import { sendProviderError } from "../../../lib/apiError"

const PROVIDERS = ["claude", "openai", "gemini"]

function normalizeSentence(s) {
  return (s || "").replace(/\s+/g, " ").trim()
}

function buildWordPrompt(word, count, level) {
  const levelLine = buildLevelInstruction(level)
  return `次の英単語について、自然な例文を${count}個つくってください。
もしスペルに誤りがあれば正しい単語に直し、その正しい単語を "word" に入れてください（正しければそのまま返す）。
${levelLine}
トーン（カジュアルさ・かしこまり具合）は、その単語の性質や自然な使われ方に合わせてください。
各例文は自然な長さ（長くても30語程度）にし、必ずその正しい単語を含めること。
各英文に、自然な日本語訳をつけること。
出力は次のJSON形式のみ（説明文なし）:
{"word":"正しいスペルの単語","sentences":[{"en":"…","ja":"…"}]}

単語: ${word}`
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" })
  }

  try {
    // 簡易レート制限（未設定なら常に許可）
    const rl = await checkRateLimit(req)
    if (!rl.success) {
      return res.status(429).json({ error: "rate_limited", detail: "アクセスが集中しています。少し時間をおいて、もう一度お試しください。" })
    }

    const { provider, apiKey, word, count, level, model } = req.body || {}
    if (!PROVIDERS.includes(provider)) return res.status(400).json({ error: "invalid_provider" })
    if (!apiKey || !String(apiKey).trim()) return res.status(400).json({ error: "missing_api_key" })
    if (!word || !String(word).trim()) return res.status(400).json({ error: "empty_word" })

    const n = Math.min(4, Math.max(1, parseInt(count, 10) || 1))
    const w = String(word).trim()

    const { json, usage } = await generateJSON({
      provider,
      apiKey,
      model,
      prompt: buildWordPrompt(w, n, level),
      maxTokens: 900,
    })

    const raw = Array.isArray(json?.sentences) ? json.sentences : []
    const sentences = raw
      .map((s) => ({ en: normalizeSentence(s?.en), ja: normalizeSentence(s?.ja) }))
      .filter((s) => s.en)
      .slice(0, n)

    if (sentences.length === 0) {
      return res.status(502).json({ error: "generation_failed", detail: "生成に失敗しました。もう一度お試しください。" })
    }

    // AIが返した正しい綴り（誤字修正）。無ければ入力のまま。
    const corrected = (json?.word || "").toString().trim()
    return res.status(200).json({ word: w, corrected: corrected || null, sentences, usage })
  } catch (e) {
    return sendProviderError(res, e)
  }
}
