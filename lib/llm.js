// AI（LLM）呼び出しのプロバイダ抽象化レイヤ（BYOK版）。
//
// Pochi-next の lib/llm.js との最大の違い:
//   - APIキーとプロバイダは「環境変数」ではなく「呼び出し引数（＝リクエスト由来）」で受け取る。
//   - キーはこのレイヤ内で使い捨て。保存もログもしない（呼び出し側も同様）。
//   - 各社のエラーを共通コード（invalid_key / rate_limited / unavailable / content_blocked）へ正規化。
//
// 対応プロバイダ: "claude" / "openai" / "gemini"

const DEFAULT_MODELS = {
  claude: "claude-haiku-4-5",
  openai: "gpt-4o-mini",
  gemini: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// APIキーを安全化する。コピペ由来のBOM(U+FEFF)・ゼロ幅スペース・前後空白・引用符を除去。
// これらがヘッダに混ざると「Cannot convert argument to a ByteString」等で丸ごと失敗するため。
function cleanKey(raw) {
  return (raw || "")
    .replace(/[﻿​‌‍⁠]/g, "") // BOM/ゼロ幅スペース等の不可視文字
    .replace(/^["']|["']$/g, "")                       // 誤って含んだ引用符
    .trim()
}

// エラーに共通コードを付与して返す（メッセージ本文＝キーは含めない）。
function assignCode(e, code) {
  const err = e instanceof Error ? e : new Error(String(e))
  err.code = code
  return err
}

// 各社SDKの例外を共通コードへ正規化する。
function normalizeError(e) {
  if (e?.code === "content_blocked") return e
  const status = e?.status ?? e?.statusCode
  const msg = String(e?.message || "")
  if (status === 401 || status === 403 ||
      /invalid[_ ]?api[_ ]?key|api key not valid|API_KEY_INVALID|incorrect api key|PERMISSION_DENIED|unauthorized/i.test(msg)) {
    return assignCode(e, "invalid_key")
  }
  if (status === 429 || /rate limit|RESOURCE_EXHAUSTED|\bquota\b|too many requests/i.test(msg)) {
    return assignCode(e, "rate_limited")
  }
  if (status === 500 || status === 503 || status === 529 || /overloaded|unavailable|internal/i.test(msg)) {
    return assignCode(e, "unavailable")
  }
  return e
}

// 各社の usage を共通形 { input, output, total } に正規化する。
function usageClaude(u) {
  if (!u) return null
  const i = u.input_tokens || 0
  const o = u.output_tokens || 0
  return { input: i, output: o, total: i + o }
}
function usageOpenAI(u) {
  if (!u) return null
  const i = u.prompt_tokens || 0
  const o = u.completion_tokens || 0
  return { input: i, output: o, total: u.total_tokens || i + o }
}
function usageGemini(u) {
  if (!u) return null
  const i = u.promptTokenCount || 0
  const o = u.candidatesTokenCount || 0
  return { input: i, output: o, total: u.totalTokenCount || i + o }
}

// JSON形式の応答を返すLLM呼び出し（BYOK）。
// 引数: provider, apiKey, model?（省略時はプロバイダ既定）, system, prompt, maxTokens
// 戻り値: { json: パース済みオブジェクト, usage: {input,output,total}|null }
export async function generateJSON({ provider, apiKey, model, system = "", prompt, maxTokens = 1500 }) {
  const key = cleanKey(apiKey)
  const mdl = model || DEFAULT_MODELS[provider]
  if (!key) throw assignCode(new Error("missing api key"), "invalid_key")

  let r
  if (provider === "claude") r = await callClaude({ apiKey: key, model: mdl, system, prompt, maxTokens })
  else if (provider === "openai") r = await callOpenAI({ apiKey: key, model: mdl, system, prompt, maxTokens })
  else if (provider === "gemini") r = await callGemini({ apiKey: key, model: mdl, system, prompt, maxTokens })
  else throw new Error(`unknown LLM provider: ${provider}`)

  return { json: parseJSONLoose(r.text), usage: r.usage }
}

// --- Claude アダプタ --- 戻り: { text, usage }
async function callClaude({ apiKey, model, system, prompt, maxTokens }) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk")
  const client = new Anthropic({ apiKey })
  try {
    const res = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: system || undefined,
      messages: [{ role: "user", content: prompt }],
    })
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("")
    return { text, usage: usageClaude(res.usage) }
  } catch (e) {
    throw normalizeError(e)
  }
}

// --- OpenAI アダプタ --- 戻り: { text, usage }
async function callOpenAI({ apiKey, model, system, prompt, maxTokens }) {
  const { default: OpenAI } = await import("openai")
  const client = new OpenAI({ apiKey })
  try {
    const res = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      temperature: 0.7,
      response_format: { type: "json_object" }, // JSONで返させる（prompt内に「JSON」の語が必要）
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt },
      ],
    })
    return { text: res.choices?.[0]?.message?.content || "", usage: usageOpenAI(res.usage) }
  } catch (e) {
    throw normalizeError(e)
  }
}

// --- Gemini アダプタ --- 戻り: { text, usage }
async function callGemini({ apiKey, model, system, prompt, maxTokens }) {
  const { GoogleGenAI } = await import("@google/genai")
  const ai = new GoogleGenAI({ apiKey })
  const params = {
    model,
    contents: prompt,
    config: {
      ...(system ? { systemInstruction: system } : {}),
      maxOutputTokens: maxTokens,
      temperature: 0.7,
      thinkingConfig: { thinkingBudget: 0 }, // この用途は推論不要（コスト・レイテンシ抑制）
      responseMimeType: "application/json",
    },
  }

  const maxAttempts = 3
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await ai.models.generateContent(params)
      // 安全フィルタでブロックされた場合（リトライ不要）
      const blockReason = res?.promptFeedback?.blockReason
      const finishReason = res?.candidates?.[0]?.finishReason
      if (blockReason || finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT") {
        throw assignCode(new Error(`content blocked: ${blockReason || finishReason}`), "content_blocked")
      }
      return { text: res.text, usage: usageGemini(res.usageMetadata) }
    } catch (e) {
      if (e?.code === "content_blocked") throw e
      const status = e?.status
      const msg = String(e?.message || "")
      if (status === 401 || status === 403 || /API_KEY_INVALID|api key not valid|PERMISSION_DENIED/i.test(msg)) {
        throw assignCode(e, "invalid_key")
      }
      if (status === 429 || /RESOURCE_EXHAUSTED|Too Many Requests|\bquota\b|\b429\b/i.test(msg)) {
        throw assignCode(e, "rate_limited")
      }
      const transient = status === 503 || status === 500 || /UNAVAILABLE|overloaded|\b503\b|\b500\b|internal/i.test(msg)
      if (transient && attempt < maxAttempts) {
        await sleep(400 * attempt) // 400ms → 800ms
        continue
      }
      if (transient) throw assignCode(e, "unavailable")
      throw e
    }
  }
}

// ==================== ストリーミング（チャット用）====================
// messages: [{ role: "user"|"assistant", content }]。onDelta(textChunk) を逐次呼ぶ。戻り値は全文。
export async function streamChat({ provider, apiKey, model, system = "", messages = [], maxTokens = 400, onDelta }) {
  const key = cleanKey(apiKey)
  const mdl = model || DEFAULT_MODELS[provider]
  if (!key) throw assignCode(new Error("missing api key"), "invalid_key")

  if (provider === "claude") return streamClaude({ apiKey: key, model: mdl, system, messages, maxTokens, onDelta })
  if (provider === "openai") return streamOpenAI({ apiKey: key, model: mdl, system, messages, maxTokens, onDelta })
  if (provider === "gemini") return streamGemini({ apiKey: key, model: mdl, system, messages, maxTokens, onDelta })
  throw new Error(`unknown LLM provider: ${provider}`)
}

async function streamClaude({ apiKey, model, system, messages, maxTokens, onDelta }) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk")
  const client = new Anthropic({ apiKey })
  try {
    const stream = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: system || undefined,
      messages,
      stream: true,
    })
    let full = ""
    let inputTokens = 0
    let outputTokens = 0
    for await (const event of stream) {
      if (event.type === "message_start") inputTokens = event.message?.usage?.input_tokens || 0
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
        full += event.delta.text
        onDelta && onDelta(event.delta.text)
      }
      if (event.type === "message_delta" && event.usage) outputTokens = event.usage.output_tokens || outputTokens
    }
    return { text: full, usage: { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens } }
  } catch (e) {
    throw normalizeError(e)
  }
}

async function streamOpenAI({ apiKey, model, system, messages, maxTokens, onDelta }) {
  const { default: OpenAI } = await import("openai")
  const client = new OpenAI({ apiKey })
  try {
    const stream = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      temperature: 0.8,
      stream: true,
      stream_options: { include_usage: true }, // 最終チャンクに usage を含めさせる
      messages: [...(system ? [{ role: "system", content: system }] : []), ...messages],
    })
    let full = ""
    let usage = null
    for await (const chunk of stream) {
      const t = chunk.choices?.[0]?.delta?.content
      if (t) {
        full += t
        onDelta && onDelta(t)
      }
      if (chunk.usage) usage = usageOpenAI(chunk.usage)
    }
    return { text: full, usage }
  } catch (e) {
    throw normalizeError(e)
  }
}

async function streamGemini({ apiKey, model, system, messages, maxTokens, onDelta }) {
  const { GoogleGenAI } = await import("@google/genai")
  const ai = new GoogleGenAI({ apiKey })
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }))
  try {
    const res = await ai.models.generateContentStream({
      model,
      contents,
      config: {
        ...(system ? { systemInstruction: system } : {}),
        maxOutputTokens: maxTokens,
        temperature: 0.8,
      },
    })
    let full = ""
    let usage = null
    for await (const chunk of res) {
      const t = chunk.text
      if (t) {
        full += t
        onDelta && onDelta(t)
      }
      if (chunk.usageMetadata) usage = usageGemini(chunk.usageMetadata)
    }
    return { text: full, usage }
  } catch (e) {
    throw normalizeError(e)
  }
}

// コードフェンス等で包まれても拾えるようにゆるくJSONパースする。
export function parseJSONLoose(text) {
  if (!text) throw new Error("empty LLM response")
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  try {
    return JSON.parse(cleaned)
  } catch {
    // 最初の { から最後の } までを抜き出して再試行
    const start = cleaned.indexOf("{")
    const end = cleaned.lastIndexOf("}")
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1))
    }
    throw new Error("failed to parse LLM JSON response")
  }
}
