// 4ストアの読み書き（CRUD）。UIからはここだけ呼べばよい。
import { getDB } from "./db"
import { uid, buildSentence } from "./sentence"

function clampCount(n) {
  return Math.min(4, Math.max(1, parseInt(n, 10) || 1))
}

// ==================== settings ====================
const SETTINGS_KEY = "app"

export const DEFAULT_SETTINGS = {
  key: SETTINGS_KEY,
  provider: null, // "claude" | "openai" | "gemini"
  apiKey: "",
  model: "", // 空ならプロバイダ既定モデル
  defaultCount: 3, // 単語1つあたりの既定生成数(1〜4)
  levelMode: "cefr",
  cefrLevel: "A1",
  grammarLevel: 1,
  dailyTokenLimit: 0, // 1日のトークン上限（目安）。0=未設定
  dailyRequestLimit: 0, // 1日のリクエスト回数上限（目安）。0=未設定
  monthlyTokenLimit: 0, // 1か月のトークン上限（目安）。0=未設定
}

export async function getSettings() {
  const db = await getDB()
  const rec = await db.get("settings", SETTINGS_KEY)
  const merged = { ...DEFAULT_SETTINGS, ...(rec || {}) }
  if (rec && !rec.levelMode && rec.difficulty) {
    merged.levelMode = "cefr"
    merged.cefrLevel = rec.difficulty === "business" ? "B2" : "B1"
  }
  return merged
}

export async function saveSettings(patch) {
  const db = await getDB()
  const cur = await getSettings()
  const next = { ...cur, ...patch, key: SETTINGS_KEY }
  await db.put("settings", next)
  if (typeof window !== "undefined") window.dispatchEvent(new Event("pm:settings"))
  return next
}

// 生成リクエストに載せる {provider, apiKey, model}
export async function getApiConfig() {
  const s = await getSettings()
  return { provider: s.provider, apiKey: s.apiKey, model: s.model || undefined }
}

// ==================== words ====================
export async function addWord({ word, requestedCount = 1 }) {
  const db = await getDB()
  const rec = {
    id: uid("w"),
    word: (word || "").trim(),
    requestedCount: clampCount(requestedCount),
    generated: false, // 英文・和訳を生成したか
    done: false, // 練習をやったか
    confidence: 0, // 自信度 0=未設定/1〜3
    createdAt: Date.now(),
  }
  await db.put("words", rec)
  return rec
}

export async function listWords() {
  const db = await getDB()
  const all = await db.getAll("words")
  return all.sort((a, b) => a.createdAt - b.createdAt)
}

export async function getWord(id) {
  return (await getDB()).get("words", id)
}

export async function updateWord(id, patch) {
  const db = await getDB()
  const cur = await db.get("words", id)
  if (!cur) return null
  const next = { ...cur, ...patch, id }
  await db.put("words", next)
  return next
}

// 単語削除。ぶら下がる例文も同一トランザクションで消す。
export async function deleteWord(id) {
  const db = await getDB()
  const tx = db.transaction(["words", "sentences"], "readwrite")
  await tx.objectStore("words").delete(id)
  const idx = tx.objectStore("sentences").index("by_word")
  let cursor = await idx.openCursor(id)
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.done
}

// ==================== sentences ====================
export async function getSentencesByWord(wordId) {
  const db = await getDB()
  return db.getAllFromIndex("sentences", "by_word", wordId)
}

// 生成結果を保存し、その単語を generated=true にする（1トランザクション）。
// ★1単語ずつコミットするので、バッチ生成の途中で失敗しても済んだ分は残る。
export async function saveGeneratedSentences(wordId, pairs) {
  const db = await getDB()
  const built = (pairs || []).map((p) => ({ ...buildSentence(p), wordId }))
  const tx = db.transaction(["sentences", "words"], "readwrite")
  const sStore = tx.objectStore("sentences")
  for (const s of built) await sStore.put(s)
  const word = await tx.objectStore("words").get(wordId)
  if (word) await tx.objectStore("words").put({ ...word, generated: true })
  await tx.done
  return built
}

// 既存例文を消してから入れ直す（再生成用）。
export async function replaceGeneratedSentences(wordId, pairs) {
  const db = await getDB()
  const tx = db.transaction(["sentences", "words"], "readwrite")
  const sStore = tx.objectStore("sentences")
  let cursor = await sStore.index("by_word").openCursor(wordId)
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  const built = (pairs || []).map((p) => ({ ...buildSentence(p), wordId }))
  for (const s of built) await sStore.put(s)
  const word = await tx.objectStore("words").get(wordId)
  if (word) await tx.objectStore("words").put({ ...word, generated: true })
  await tx.done
  return built
}

// ==================== stories（My長文）====================
export async function addStory({ title = "", inputLang, pairs }) {
  const db = await getDB()
  const rec = {
    id: uid("story"),
    title: (title || "").trim(),
    inputLang,
    sentences: (pairs || []).map(buildSentence), // 埋め込み
    done: false,
    confidence: 0,
    createdAt: Date.now(),
  }
  await db.put("stories", rec)
  return rec
}

export async function listStories() {
  const db = await getDB()
  const all = await db.getAll("stories")
  return all.sort((a, b) => b.createdAt - a.createdAt) // 新しい順
}

export async function getStory(id) {
  return (await getDB()).get("stories", id)
}

export async function updateStory(id, patch) {
  const db = await getDB()
  const cur = await db.get("stories", id)
  if (!cur) return null
  const next = { ...cur, ...patch, id }
  await db.put("stories", next)
  return next
}

export async function deleteStory(id) {
  await (await getDB()).delete("stories", id)
}

// ==================== chats（AIとはなそう）====================
export async function createChat() {
  const db = await getDB()
  const rec = { id: uid("chat"), title: "", messages: [], createdAt: Date.now(), updatedAt: Date.now() }
  await db.put("chats", rec)
  return rec
}

export async function listChats() {
  const db = await getDB()
  const all = await db.getAll("chats")
  return all.sort((a, b) => b.updatedAt - a.updatedAt) // 新しい順
}

export async function getChat(id) {
  return (await getDB()).get("chats", id)
}

// chat 全体を保存（updatedAt を更新）
export async function saveChat(chat) {
  const db = await getDB()
  const next = { ...chat, updatedAt: Date.now() }
  await db.put("chats", next)
  return next
}

export async function deleteChat(id) {
  await (await getDB()).delete("chats", id)
}

// ==================== usage（トークン使用量・日別）====================
// JST（UTC+9）の日付 "YYYY-MM-DD"。JST0時で自動リセットされる。
export function usageDate() {
  const d = new Date(Date.now() + 9 * 3600 * 1000)
  return d.toISOString().slice(0, 10)
}

// 1回のAPI呼び出しぶんを今日の合計に加算する。
// 呼ぶたびに requests を +1（＝リクエスト回数）。u があればトークンも加算。
// u = { input, output, total } / 省略可（回数だけ数えたいとき）
export async function addUsage(u) {
  const db = await getDB()
  const date = usageDate()
  const cur = (await db.get("usage", date)) || { date, input: 0, output: 0, total: 0, requests: 0 }
  const next = {
    date,
    input: cur.input + (u?.input || 0),
    output: cur.output + (u?.output || 0),
    total: cur.total + (u?.total || 0),
    requests: (cur.requests || 0) + 1,
  }
  await db.put("usage", next)
  if (typeof window !== "undefined") window.dispatchEvent(new Event("pm:usage"))
  return next
}

export async function getTodayUsage() {
  const db = await getDB()
  const date = usageDate()
  return (await db.get("usage", date)) || { date, input: 0, output: 0, total: 0, requests: 0 }
}

// JST の当月 "YYYY-MM"
export function usageMonth() {
  const d = new Date(Date.now() + 9 * 3600 * 1000)
  return d.toISOString().slice(0, 7)
}

// 当月の合計（日別レコードを月で集計）。JST月初で自然にリセット。
export async function getMonthUsage(month) {
  const db = await getDB()
  const m = month || usageMonth()
  const all = await db.getAll("usage")
  const acc = { month: m, input: 0, output: 0, total: 0, requests: 0 }
  for (const r of all) {
    if (r.date && r.date.startsWith(m)) {
      acc.input += r.input || 0
      acc.output += r.output || 0
      acc.total += r.total || 0
      acc.requests += r.requests || 0
    }
  }
  return acc
}
