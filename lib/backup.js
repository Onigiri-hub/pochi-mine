// 端末間の移行/コピー（JSONエクスポート・インポート）。
// 学習データ（words/sentences/stories）＋設定（settings）＋使用量（usage）を持ち運ぶ。
// ★APIキーだけは含めない（新端末では設定で入れ直す）。
import { getDB, SCHEMA_VERSION } from "./db"
import { getSettings, saveSettings } from "./store"

// 学習データ・設定・使用量を1つのオブジェクトに固める。
export async function exportData() {
  const db = await getDB()
  const [words, sentences, stories, usage, settingsRec] = await Promise.all([
    db.getAll("words"),
    db.getAll("sentences"),
    db.getAll("stories"),
    db.getAll("usage"),
    getSettings(),
  ])
  // ★APIキーはバックアップに乗せない（キーを除いた設定だけ持ち運ぶ）
  const { apiKey, ...settings } = settingsRec
  return {
    app: "pochi-mine",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    words,
    sentences,
    stories,
    usage,
    settings,
  }
}

export async function exportJSON() {
  return JSON.stringify(await exportData(), null, 2)
}

// ファイルとしてダウンロード（機種変・バックアップ用）
export async function downloadBackup(filename) {
  const json = await exportJSON()
  const blob = new Blob([json], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename || `pochi-mine-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// クリップボードへコピー（コピーボタン用）。戻り値: 文字数
export async function copyBackupToClipboard() {
  const json = await exportJSON()
  await navigator.clipboard.writeText(json)
  return json.length
}

// インポート（マージ: id一致は上書き。IDはUUIDなので実質は追加）。
// usage は日付キーで上書き（機種変=移行先は空なのでその時点の使用量が復元される）。
// settings はマージ。★APIキーは含まれないので既存端末のキーはそのまま残る。
// 戻り値: { words, sentences, stories, usage, settings } （settingsは反映有無のbool）
export async function importData(input) {
  const data = typeof input === "string" ? JSON.parse(input) : input
  if (!data || data.app !== "pochi-mine") {
    throw new Error("このファイルは Pochi-Mine のバックアップではありません")
  }
  if (typeof data.schemaVersion === "number" && data.schemaVersion > SCHEMA_VERSION) {
    throw new Error("より新しいバージョンのバックアップです。アプリを更新してからお試しください")
  }
  const db = await getDB()
  const tx = db.transaction(["words", "sentences", "stories", "usage"], "readwrite")
  const counts = { words: 0, sentences: 0, stories: 0, usage: 0 }
  for (const w of data.words || []) {
    await tx.objectStore("words").put(w)
    counts.words++
  }
  for (const s of data.sentences || []) {
    await tx.objectStore("sentences").put(s)
    counts.sentences++
  }
  for (const st of data.stories || []) {
    await tx.objectStore("stories").put(st)
    counts.stories++
  }
  for (const u of data.usage || []) {
    if (!u || !u.date) continue
    await tx.objectStore("usage").put(u)
    counts.usage++
  }
  await tx.done

  // 設定はマージ（保存後にトークンメーター等へ pm:settings/pm:usage が飛ぶ）。
  // 念のため apiKey / key は除外してから保存＝既存キーを壊さない。
  let settingsImported = false
  if (data.settings && typeof data.settings === "object") {
    const { apiKey, key, ...rest } = data.settings
    await saveSettings(rest)
    settingsImported = true
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event("pm:usage"))
  return { ...counts, settings: settingsImported }
}
