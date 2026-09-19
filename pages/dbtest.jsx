// 開発用のセルフテストページ（/dbtest）。UIは次フェーズ。
// IndexedDBアクセス層が一通り動くかをブラウザで確認するための仮画面。
import { useState } from "react"
import {
  addWord,
  saveGeneratedSentences,
  getSentencesByWord,
  listWords,
  addStory,
  listStories,
  getSettings,
  saveSettings,
} from "../lib/store"
import { exportData } from "../lib/backup"

export default function DbTest() {
  const [log, setLog] = useState("")
  const append = (obj) =>
    setLog((l) => l + (typeof obj === "string" ? obj : JSON.stringify(obj, null, 2)) + "\n")

  async function runSelfTest() {
    setLog("")
    try {
      append("① 単語を登録…")
      const w = await addWord({ word: "appreciate", requestedCount: 2 })
      append(w)

      append("\n② 生成結果を保存（generated=true へ）…")
      const built = await saveGeneratedSentences(w.id, [
        { en: "I really appreciate your help today.", ja: "今日のあなたの助けに本当に感謝しています。" },
        { en: "We would appreciate a quick reply.", ja: "早めに返信をいただけると助かります。" },
      ])
      append(built)

      append("\n③ 単語ごとに例文を取得（by_word インデックス）…")
      append(await getSentencesByWord(w.id))

      append("\n④ 単語一覧（generated が true になっているか）…")
      append(await listWords())

      append("\n⑤ MY長文を保存…")
      const st = await addStory({
        title: "海に行った",
        inputLang: "ja",
        pairs: [{ en: "I went to the beach.", ja: "海に行った。" }],
      })
      append({ id: st.id, title: st.title, sentences: st.sentences })
      append(await listStories())

      append("\n⑥ 設定の保存/読み込み（apiKey はマスク表示）…")
      await saveSettings({ provider: "gemini", defaultCount: 3 })
      const s = await getSettings()
      append({ ...s, apiKey: s.apiKey ? "***" : "" })

      append("\n⑦ エクスポート（settings/APIキーが含まれないこと）…")
      const dump = await exportData()
      append({
        hasSettingsField: "settings" in dump,
        topKeys: Object.keys(dump),
        words: dump.words.length,
        sentences: dump.sentences.length,
        stories: dump.stories.length,
      })

      append("\n✅ セルフテスト成功")
    } catch (e) {
      append("\n❌ エラー: " + (e?.message || e))
    }
  }

  function clearDb() {
    indexedDB.deleteDatabase("pochi-mine")
    setLog("DB（pochi-mine）を削除しました。ページをリロードすると作り直されます。")
  }

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: "0 20px", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 20 }}>IndexedDB セルフテスト</h1>
      <div style={{ display: "flex", gap: 10, margin: "12px 0" }}>
        <button onClick={runSelfTest} style={btn("#333")}>セルフテスト実行</button>
        <button onClick={clearDb} style={btn("#b00")}>DB削除</button>
      </div>
      <pre style={{ background: "#111", color: "#0f0", padding: 14, borderRadius: 8, fontSize: 12, whiteSpace: "pre-wrap", minHeight: 200 }}>
        {log || "「セルフテスト実行」を押すと、登録→生成保存→取得→エクスポートを一通り試します。"}
      </pre>
    </main>
  )
}

function btn(bg) {
  return { padding: "10px 16px", borderRadius: 8, border: "none", background: bg, color: "#fff", fontWeight: "bold", cursor: "pointer" }
}
