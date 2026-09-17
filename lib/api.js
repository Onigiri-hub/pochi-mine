import { addUsage } from "./store"

// ストリーム末尾の使用トークンマーカー（server: pages/api/chat.js と一致させる）
const USAGE_MARKER = "\n[[USAGE]]"

// 1回のAPI呼び出しを集計（リクエスト回数を+1、トークンがあれば加算）。
async function recordUsage(usage) {
  try {
    await addUsage(usage || {})
  } catch {}
}

// プロキシAPIのクライアント。エラーは detail 付きの Error にして投げる。usage は自動集計。
async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.detail || data.error || "リクエストに失敗しました")
    err.code = data.error
    err.status = res.status
    throw err
  }
  await recordUsage(data.usage)
  return data
}

// 単語 → 例文＋和訳。戻り: { word, sentences:[{en,ja}] }
export function generateWord({ provider, apiKey, word, count, difficulty, model }) {
  return postJSON("/api/generate/word", { provider, apiKey, word, count, difficulty, model })
}

// My長文 → 文リスト。戻り: { title, inputLang, sentences:[{en,ja}] }
export function generateStory(payload) {
  return postJSON("/api/generate/story", payload)
}

// 英文1文の和訳。戻り: { ja }
export function translateSentence({ provider, apiKey, model, en }) {
  return postJSON("/api/translate", { provider, apiKey, model, en })
}

// 文脈中の単語の意味。戻り: { meaning }
export function wordMeaning({ provider, apiKey, model, word, sentence }) {
  return postJSON("/api/wordMeaning", { provider, apiKey, model, word, sentence })
}

// ユーザーの入力文を自然な英語に変換（日本語→英訳／英語→自然な英語）。戻り: { en }
export function refineToEnglish({ provider, apiKey, model, text }) {
  return postJSON("/api/refine", { provider, apiKey, model, text })
}

// チャット（ストリーミング）。onDelta(chunk, whole) を逐次呼ぶ。戻り値は全文。
export async function streamChat({ provider, apiKey, model, messages, difficulty, tone }, onDelta) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, apiKey, model, messages, difficulty, tone }),
  })
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}))
    const err = new Error(data.detail || data.error || "チャットに失敗しました")
    err.code = data.error
    err.status = res.status
    throw err
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ""
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    full += decoder.decode(value, { stream: true })
    // 末尾の usage マーカーより前だけを表示に回す
    const mi = full.indexOf(USAGE_MARKER)
    const visible = mi >= 0 ? full.slice(0, mi) : full
    onDelta && onDelta(null, visible)
  }
  // usage を分離。本文だけ返し、リクエスト1回ぶんを集計（usageがあればトークンも）。
  let text = full
  let usage = null
  const mi = full.indexOf(USAGE_MARKER)
  if (mi >= 0) {
    text = full.slice(0, mi)
    try {
      usage = JSON.parse(full.slice(mi + USAGE_MARKER.length))
    } catch {}
  }
  await recordUsage(usage)
  return text
}
