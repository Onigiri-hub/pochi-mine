// My長文の作成フォーム。BYOKプロキシで生成 → IndexedDBに保存 → 再生画面へ。
// 英語レベルは設定画面で一元管理（ここでは選ばない）。トーンは内容に合わせて自動。
import { useEffect, useState } from "react"
import { useRouter } from "next/router"
import Navigation from "../components/Navigation"
import ErrorNotice from "../components/ErrorNotice"
import { getSettings, addStory } from "../lib/store"
import { generateStory } from "../lib/api"
import { pickLevel } from "../lib/difficulty"
import { preloadVoices, warmUpSpeech } from "../utils/ttsPlayer"
import { COLORS, primaryBtn, segBtn } from "../lib/ui"

function langWarning(text, inputLang) {
  const t = text || ""
  const ja = (t.match(/[぀-ゟ゠-ヿ一-鿿]/g) || []).length
  const en = (t.match(/[A-Za-z]/g) || []).length
  if (inputLang === "en" && ja >= 1) return "ja"
  if (inputLang === "ja" && en > 0 && en > ja) return "en"
  return null
}
const WARN_MESSAGE = {
  ja: "英語入力モードに日本語が入力されているようです。このまま続けますか？",
  en: "日本語入力モードに英語が入力されているようです。このまま続けますか？",
}

export default function MyStoryForm() {
  const router = useRouter()
  const [settings, setSettings] = useState(null)
  const [text, setText] = useState("")
  const [inputLang, setInputLang] = useState("en")
  const [title, setTitle] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showLangModal, setShowLangModal] = useState(false)

  useEffect(() => {
    preloadVoices()
    getSettings().then(setSettings)
  }, [])

  const limit = inputLang === "en" ? { unit: "語", max: 300 } : { unit: "字", max: 1000 }
  const count = inputLang === "en" ? (text.trim() ? text.trim().split(/\s+/).length : 0) : text.trim().length
  const over = count > limit.max
  const langWarn = langWarning(text, inputLang)

  function submit() {
    if (!text.trim() || loading || over) return
    if (langWarn) {
      setShowLangModal(true)
      return
    }
    runGenerate()
  }

  async function runGenerate() {
    if (!text.trim() || loading || over) return
    if (!settings?.provider || !settings?.apiKey) {
      setShowLangModal(false)
      const err = new Error("長文の生成にはAPIキーが必要です。設定画面で登録してください。")
      err.code = "missing_api_key"
      setError(err)
      return
    }
    warmUpSpeech()
    setShowLangModal(false)
    setLoading(true)
    setError("")
    try {
      const data = await generateStory({
        provider: settings.provider,
        apiKey: settings.apiKey,
        model: settings.model || undefined,
        text,
        inputLang,
        title,
        level: pickLevel(settings),
      })
      const story = await addStory({
        title: (title || "").trim() || "My長文",
        inputLang: data.inputLang || inputLang,
        pairs: data.sentences,
      })
      router.push(`/storyPlay?id=${story.id}`)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, background: COLORS.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px" }}>
        <video src="/animations/pochi-tokotoko.mp4" autoPlay muted loop playsInline style={{ width: "110px" }} />
        <div style={{ fontSize: "17px", fontWeight: "bold", color: "#8a5a1a" }}>生成中…</div>
        <div style={{ fontSize: "13px", color: COLORS.muted }}>並べ替え問題を準備しています</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, paddingBottom: "110px" }}>
      <div style={{ padding: "10px 20px" }}>
        <button onClick={() => router.push("/myStory")} style={{ background: "none", border: "none", fontSize: "15px", fontWeight: "bold", color: COLORS.text, cursor: "pointer" }}>
          ◀
        </button>
      </div>

      <div style={{ textAlign: "center", fontSize: "20px", fontWeight: "bold", color: COLORS.text, margin: "6px 0 24px" }}>
        My長文を作る
      </div>

      <div style={{ maxWidth: "420px", margin: "0 auto", padding: "0 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          {[["en", "英語で入力"], ["ja", "日本語で入力"]].map(([val, lbl]) => (
            <button key={val} onClick={() => setInputLang(val)} style={segBtn(inputLang === val)}>
              {lbl}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="タイトル（任意）"
          style={{ padding: "12px", borderRadius: "10px", border: `1px solid ${COLORS.line}`, fontSize: "15px" }}
        />

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={inputLang === "en" ? "英語の文章を入力してね" : "日本語の文章を入力してね"}
          rows={7}
          style={{ padding: "12px", borderRadius: "10px", border: `1px solid ${COLORS.line}`, fontSize: "15px", lineHeight: 1.6, resize: "vertical" }}
        />
        <div style={{ textAlign: "right", fontSize: "13px", color: over ? COLORS.danger : COLORS.muted }}>
          {count} / {limit.max}{limit.unit}
        </div>

        {inputLang === "ja" && (
          <div style={{ fontSize: "12px", color: COLORS.muted }}>
            英語のレベルは
            <button onClick={() => router.push("/settings")} style={{ background: "none", border: "none", color: COLORS.primary, fontWeight: "bold", cursor: "pointer", padding: 0, textDecoration: "underline" }}>設定</button>
            で変更できます。
          </div>
        )}

        {error && <ErrorNotice error={error} />}

        <div style={{ fontSize: "12px", color: COLORS.muted, lineHeight: 1.6, background: "#f7f7f7", borderRadius: "8px", padding: "10px 12px" }}>
          この機能はあなたのAPIキーでAIに翻訳・問題生成を依頼します。入力内容はAIサービスに送信されます。個人情報や見られたくない文章は入力しないでください。
        </div>

        <button onClick={submit} disabled={!text.trim() || over} style={{ ...primaryBtn(!text.trim() || over), width: "100%" }}>
          並べ替え問題を作る
        </button>
      </div>

      {showLangModal && (
        <div onClick={() => setShowLangModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: "16px", padding: "24px 20px", maxWidth: "340px", width: "100%", textAlign: "center", boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: "15px", color: COLORS.text, fontWeight: "bold", lineHeight: 1.7, marginBottom: "20px" }}>
              {WARN_MESSAGE[langWarn]}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setShowLangModal(false)} style={{ flex: 1, padding: "13px", borderRadius: "12px", border: `1px solid ${COLORS.line}`, background: "#fff", color: COLORS.sub, fontWeight: "bold", fontSize: "15px", cursor: "pointer" }}>
                戻る
              </button>
              <button onClick={runGenerate} style={{ flex: 1, padding: "13px", borderRadius: "12px", border: "none", background: COLORS.primary, color: "#fff", fontWeight: "bold", fontSize: "15px", cursor: "pointer" }}>
                このまま続ける
              </button>
            </div>
          </div>
        </div>
      )}

      <Navigation />
    </div>
  )
}
