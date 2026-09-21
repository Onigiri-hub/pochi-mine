// データの移行・バックアップ。学習データ（単語/例文/長文）をJSONで書き出し/取り込み。
// ★APIキーは含まれない（新端末では設定で入れ直す）。
import { useEffect, useState } from "react"
import { useRouter } from "next/router"
import Navigation from "../components/Navigation"
import { exportData, exportJSON, downloadBackup, copyBackupToClipboard, importData } from "../lib/backup"
import { markBackupDone } from "../lib/backupReminder"
import { COLORS, primaryBtn, segBtn } from "../lib/ui"

export default function Backup() {
  const router = useRouter()
  const [counts, setCounts] = useState(null)
  const [copyMsg, setCopyMsg] = useState("")
  const [fallbackText, setFallbackText] = useState("") // 自動コピー失敗時の手動コピー用
  const [pasteText, setPasteText] = useState("")
  const [importMsg, setImportMsg] = useState(null) // { ok, text }

  async function refreshCounts() {
    const d = await exportData()
    setCounts({ words: d.words.length, sentences: d.sentences.length, stories: d.stories.length, usage: d.usage.length })
  }
  useEffect(() => {
    refreshCounts()
  }, [])

  async function doCopy() {
    setCopyMsg("")
    setFallbackText("")
    try {
      const len = await copyBackupToClipboard()
      markBackupDone() // 促しポップアップの基準日時を更新
      setCopyMsg(`コピーしました（${len}文字）`)
    } catch {
      const json = await exportJSON()
      setFallbackText(json)
      setCopyMsg("自動コピーに失敗しました。下の枠のテキストを手動でコピーしてください。")
    }
  }

  async function doDownload() {
    await downloadBackup()
    markBackupDone() // 促しポップアップの基準日時を更新
  }

  async function importFromFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const c = await importData(text)
      setImportMsg({ ok: true, text: `取り込み成功：単語 ${c.words} / 例文 ${c.sentences} / 長文 ${c.stories}${c.settings ? " ／ 設定・使用量も反映" : ""}` })
      refreshCounts()
    } catch (err) {
      setImportMsg({ ok: false, text: "失敗：" + (err?.message || err) })
    }
    e.target.value = "" // 同じファイルを再選択できるように
  }

  async function importFromPaste() {
    if (!pasteText.trim()) return
    try {
      const c = await importData(pasteText)
      setImportMsg({ ok: true, text: `取り込み成功：単語 ${c.words} / 例文 ${c.sentences} / 長文 ${c.stories}` })
      setPasteText("")
      refreshCounts()
    } catch (err) {
      setImportMsg({ ok: false, text: "失敗：" + (err?.message || err) })
    }
  }

  const card = { background: "#fff", borderRadius: "14px", padding: "18px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }
  const sectionTitle = { fontSize: "15px", fontWeight: "bold", color: COLORS.text, marginBottom: "10px" }
  const note = { fontSize: "12px", color: COLORS.muted, lineHeight: 1.6, marginTop: "10px" }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, paddingBottom: "90px" }}>
      <div style={{ padding: "10px 20px" }}>
        <button onClick={() => router.push("/settings")} style={{ background: "none", border: "none", fontSize: "15px", fontWeight: "bold", color: COLORS.text, cursor: "pointer" }}>◀</button>
      </div>
      <div style={{ textAlign: "center", fontSize: "20px", fontWeight: "bold", color: COLORS.text, margin: "4px 0 20px" }}>
        データの移行・バックアップ
      </div>

      <div style={{ maxWidth: "440px", margin: "0 auto", padding: "0 16px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* 現在のデータ */}
        <div style={{ textAlign: "center", fontSize: "13px", color: COLORS.sub }}>
          {counts ? `現在：単語 ${counts.words} / 例文 ${counts.sentences} / 長文 ${counts.stories}` : "読み込み中…"}
        </div>

        {/* エクスポート */}
        <div style={card}>
          <div style={sectionTitle}>📤 書き出し・保存</div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={doDownload} style={{ ...primaryBtn(false), flex: 1, padding: "12px" }}>ファイルに保存</button>
            <button onClick={doCopy} style={{ ...segBtn(false), flex: 1, padding: "12px" }}>コピー</button>
          </div>
          {copyMsg && <div style={{ ...note, color: COLORS.sub }}>{copyMsg}</div>}
          {fallbackText && (
            <textarea
              readOnly
              value={fallbackText}
              onFocus={(e) => e.target.select()}
              rows={5}
              style={{ width: "100%", marginTop: "10px", padding: "10px", borderRadius: "8px", border: `1px solid ${COLORS.line}`, fontSize: "11px", boxSizing: "border-box" }}
            />
          )}
          <div style={note}>学習データに加えて、設定（トークン上限・例文数・英語レベルなど）と使用量（今日/今月のトークン・回数）も一緒に書き出します。<b>APIキーと「きままにTALK」の会話内容は含まれません</b>（TALKの履歴は引き継がれません）。新しい端末では設定でキーを入れ直してください。</div>
        </div>

        {/* インポート */}
        <div style={card}>
          <div style={sectionTitle}>📥 データ読み込み</div>

          <label style={{ ...primaryBtn(false), display: "block", textAlign: "center", padding: "12px", background: COLORS.primary }}>
            ファイルを選ぶ
            <input type="file" accept="application/json,.json" onChange={importFromFile} style={{ display: "none" }} />
          </label>

          <div style={{ textAlign: "center", fontSize: "12px", color: COLORS.muted, margin: "12px 0 8px" }}>または貼り付けて取り込み</div>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="コピーしたバックアップJSONをここに貼り付け"
            rows={4}
            style={{ width: "100%", padding: "10px", borderRadius: "8px", border: `1px solid ${COLORS.line}`, fontSize: "12px", boxSizing: "border-box" }}
          />
          <button onClick={importFromPaste} disabled={!pasteText.trim()} style={{ ...segBtn(false), width: "100%", marginTop: "8px", padding: "12px", opacity: pasteText.trim() ? 1 : 0.5 }}>
            貼り付けたデータを取り込む
          </button>

          {importMsg && (
            <div style={{ marginTop: "10px", fontSize: "13px", fontWeight: "bold", color: importMsg.ok ? COLORS.ok : COLORS.danger, lineHeight: 1.6 }}>
              {importMsg.ok ? "✓ " : "✗ "}{importMsg.text}
            </div>
          )}
          <div style={note}>学習データは「追加（マージ）」で、同じデータは重複しません。設定と使用量は取り込んだ内容で上書きされます（APIキーはそのまま残ります）。</div>
        </div>
      </div>

      <Navigation />
    </div>
  )
}
