// POST /api/generate/story
// My長文（ユーザー投稿の文章）を並べ替え用の文リストに変換する（BYOK）。
// en入力: 英文はサーバー側で文末記号で機械分割し、AIには和訳だけ出させる（出力トークン節約）。
//         和訳は「英文の雰囲気を反映した自然な日本語」で、レベル指定はしない。
// ja入力: AIが英語生成＋文分割＋和訳をまとめて行う（英語レベルは設定に従う）。
//
// リクエストbody: { provider, apiKey, text, inputLang("en"|"ja"), title?, level?, model? }
//   level = { levelMode, cefrLevel, grammarLevel }

import { generateJSON } from "../../../lib/llm"
import { buildLevelInstruction } from "../../../lib/difficulty"
import { checkRateLimit } from "../../../lib/rateLimit"
import { sendProviderError } from "../../../lib/apiError"

const PROVIDERS = ["claude", "openai", "gemini"]
// プロキシの計算枠を守るための上限（BYOKなのでPochi-nextの無料枠より緩め）。
const MAX_EN_WORDS = 300
const MAX_JA_CHARS = 500

function normalizeSentence(s) {
  return (s || "").replace(/\s+/g, " ").trim()
}

// 略語っぽいトークン（Mr. / U.S. / e.g. 等）は文末とみなさず次に結合する
function isAbbrev(tok) {
  return /\.\w/.test(tok) || /^(mr|mrs|ms|dr|prof|st|vs|etc|no|inc|co|ltd)\.$/i.test(tok)
}

// 英文を文末記号（. ! ? ; :）で機械分割。カンマ・途中では切らない。
function splitEnglishSentences(text) {
  const rough = text
    .replace(/([.!?;:])\s+/g, "$1\n")
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean)
  const merged = []
  for (const piece of rough) {
    const prev = merged[merged.length - 1]
    if (prev && !prev.includes(" ") && isAbbrev(prev)) {
      merged[merged.length - 1] = `${prev} ${piece}`
    } else {
      merged.push(piece)
    }
  }
  return merged.map(normalizeSentence).filter(Boolean)
}

// en入力: 分割済み英文 → 和訳だけ番号順で返させる最小プロンプト
function buildEnTranslatePrompt(enList, jaNote) {
  const numbered = enList.map((s, i) => `${i + 1}. ${s}`).join("\n")
  return `次の英文を1つずつ${jaNote}に翻訳してください。英文と同じ数・同じ順番で訳を返すこと。
出力は次のJSON形式のみ（説明文なし）:
{"translations":["…","…"]}

英文:
${numbered}`
}

// ja入力: 英語生成＋分割＋和訳をまとめて行う最小プロンプト
function buildJaGeneratePrompt(text, levelLine) {
  return `次の日本語を英語に翻訳してください。
${levelLine}
トーン（カジュアルさ・かしこまり具合）は文章の内容に合わせて自然にしてください。
自然な長さ（長くても30語程度）で1文ずつに分け、各文に和訳をつけること。
出力は次のJSON形式のみ（説明文なし）:
{"sentences":[{"en":"…","ja":"…"}]}

日本語:
"""
${text}
"""`
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

    const { provider, apiKey, text, inputLang, title, level, model } = req.body || {}
    if (!PROVIDERS.includes(provider)) return res.status(400).json({ error: "invalid_provider" })
    if (!apiKey || !String(apiKey).trim()) return res.status(400).json({ error: "missing_api_key" })
    if (!text || !String(text).trim()) return res.status(400).json({ error: "empty_text" })
    if (inputLang !== "en" && inputLang !== "ja") return res.status(400).json({ error: "invalid_inputLang" })

    // 入力量の上限チェック（プロキシ計算枠の保護）
    if (inputLang === "en") {
      const words = text.trim().split(/\s+/).length
      if (words > MAX_EN_WORDS) {
        return res.status(400).json({ error: "too_long", detail: `英語は${MAX_EN_WORDS}語までです（現在${words}語）` })
      }
    } else {
      const chars = text.trim().length
      if (chars > MAX_JA_CHARS) {
        return res.status(400).json({ error: "too_long", detail: `日本語は${MAX_JA_CHARS}字までです（現在${chars}字）` })
      }
    }

    let sentences
    let usage = null
    if (inputLang === "en") {
      // 英文は機械分割 → AIは和訳のみ（レベル指定なし・英文の雰囲気を反映）
      const enList = splitEnglishSentences(text)
      if (enList.length === 0) return res.status(502).json({ error: "generation_failed" })
      const jaNote = "英文の雰囲気を反映した自然な日本語"
      const { json, usage: u } = await generateJSON({
        provider,
        apiKey,
        model,
        prompt: buildEnTranslatePrompt(enList, jaNote),
        maxTokens: 1500,
      })
      usage = u
      const translations = Array.isArray(json?.translations) ? json.translations : []
      sentences = enList.map((en, i) => ({ en, ja: normalizeSentence(translations[i] || "") }))
    } else {
      // 日本語 → 英語生成（AIが分割＋和訳もまとめて。英語レベルは設定に従う）
      const levelLine = buildLevelInstruction(level)
      const { json, usage: u } = await generateJSON({
        provider,
        apiKey,
        model,
        prompt: buildJaGeneratePrompt(text, levelLine),
        maxTokens: 1500,
      })
      usage = u
      const raw = Array.isArray(json?.sentences) ? json.sentences : []
      if (raw.length === 0) return res.status(502).json({ error: "generation_failed" })
      sentences = raw
        .map((s) => ({ en: normalizeSentence(s?.en), ja: normalizeSentence(s?.ja) }))
        .filter((s) => s.en)
    }

    if (!sentences || sentences.length === 0) {
      return res.status(502).json({ error: "generation_failed" })
    }

    return res.status(200).json({
      title: (title || "").trim(),
      inputLang,
      sentences,
      usage,
    })
  } catch (e) {
    return sendProviderError(res, e)
  }
}
