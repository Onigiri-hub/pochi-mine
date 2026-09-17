// AIとはなそう（会話画面）。日本語で話しかける → 英語が逐次で返る。
// 各文に🔊（Web Speech）＋▼（和訳・遅延取得＆キャッシュ）＋単語タップで意味。
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/router"
import { getChat, saveChat, getSettings, getApiConfig } from "../lib/store"
import { streamChat, translateSentence, wordMeaning, refineToEnglish } from "../lib/api"
import { splitSentences } from "../lib/sentence"
import { preloadVoices, warmUpSpeech, playWebSpeech, playAllWebSpeech } from "../utils/ttsPlayer"
import Navigation from "../components/Navigation"
import ErrorNotice from "../components/ErrorNotice"
import { COLORS } from "../lib/ui"

// APIキー未設定を表す Error（ErrorNotice が「設定を開く」導線を出す）。
function missingKeyError(msg) {
  const err = new Error(msg)
  err.code = "missing_api_key"
  return err
}

export default function TalkRoom() {
  const router = useRouter()
  const { id } = router.query

  const [chat, setChat] = useState(undefined) // undefined=読込中, null=無し
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState("")
  const [error, setError] = useState("")
  const [popup, setPopup] = useState(null) // { word, meaning?, loading?, error? }
  const scrollRef = useRef(null)
  const wordCacheRef = useRef(new Map()) // 単語意味の一時キャッシュ（セッション内）

  useEffect(() => {
    preloadVoices()
  }, [])

  useEffect(() => {
    if (!id) return
    getChat(id).then((c) => setChat(c || null))
  }, [id])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [chat, streamingText])

  if (chat === undefined) return <Center>読み込み中…</Center>
  if (chat === null) {
    return (
      <Center>
        <div>会話が見つかりませんでした。</div>
        <button onClick={() => router.push("/talk")} style={backBtn}>一覧へ</button>
      </Center>
    )
  }

  async function send() {
    const content = input.trim()
    if (!content || streaming) return
    setError("")
    warmUpSpeech()

    const cfg = await getApiConfig()
    if (!cfg.provider || !cfg.apiKey) {
      setError(missingKeyError("AIと話すにはAPIキーが必要です。設定画面で登録してください。"))
      return
    }
    const settings = await getSettings()

    const userMsg = { role: "user", content }
    let updated = { ...chat, messages: [...chat.messages, userMsg] }
    if (!updated.title) updated.title = content.slice(0, 20)
    setChat(updated)
    await saveChat(updated)
    setInput("")
    setStreaming(true)
    setStreamingText("")

    try {
      const full = await streamChat(
        {
          provider: cfg.provider,
          apiKey: cfg.apiKey,
          model: cfg.model,
          messages: updated.messages.map((m) => ({ role: m.role, content: m.content })),
          difficulty: settings.difficulty,
          tone: settings.tone,
        },
        (_chunk, whole) => setStreamingText(whole)
      )
      const withAssistant = { ...updated, messages: [...updated.messages, { role: "assistant", content: full }] }
      setChat(withAssistant)
      await saveChat(withAssistant)
      // 届いた瞬間にAIの返答を自動読み上げ（新しい返答だけ・過去履歴では鳴らさない）
      const parts = splitSentences(full)
      if (parts.length) playAllWebSpeech(parts)
    } catch (e) {
      setError(e)
    } finally {
      setStreaming(false)
      setStreamingText("")
    }
  }

  // 文の和訳を取得（キャッシュ済みならそれを返す）。message.tr[sentenceIdx] に保存。
  async function translateFor(messageIdx, sentenceIdx, en) {
    const msg = chat.messages[messageIdx]
    if (msg?.tr && msg.tr[sentenceIdx] !== undefined) return
    const cfg = await getApiConfig()
    if (!cfg.provider || !cfg.apiKey) {
      setError(missingKeyError("和訳にはAPIキーが必要です。設定画面で登録してください。"))
      return
    }
    try {
      const { ja } = await translateSentence({ provider: cfg.provider, apiKey: cfg.apiKey, model: cfg.model, en })
      const newMessages = chat.messages.map((m, i) =>
        i === messageIdx ? { ...m, tr: { ...(m.tr || {}), [sentenceIdx]: ja } } : m
      )
      const updated = { ...chat, messages: newMessages }
      setChat(updated)
      await saveChat(updated)
    } catch (e) {
      const newMessages = chat.messages.map((m, i) =>
        i === messageIdx ? { ...m, tr: { ...(m.tr || {}), [sentenceIdx]: "（和訳の取得に失敗しました）" } } : m
      )
      setChat({ ...chat, messages: newMessages })
    }
  }

  // ユーザー入力を自然な英語に変換（日本語→英訳／英語→自然な英語）。message.en に保存。
  async function refineFor(messageIdx, text) {
    const msg = chat.messages[messageIdx]
    if (msg?.en !== undefined) return
    const cfg = await getApiConfig()
    if (!cfg.provider || !cfg.apiKey) {
      setError(missingKeyError("英語変換にはAPIキーが必要です。設定画面で登録してください。"))
      return
    }
    try {
      const { en } = await refineToEnglish({ provider: cfg.provider, apiKey: cfg.apiKey, model: cfg.model, text })
      const newMessages = chat.messages.map((m, i) => (i === messageIdx ? { ...m, en } : m))
      const updated = { ...chat, messages: newMessages }
      setChat(updated)
      await saveChat(updated)
    } catch (e) {
      const newMessages = chat.messages.map((m, i) =>
        i === messageIdx ? { ...m, en: "（英語変換に失敗しました）" } : m
      )
      setChat({ ...chat, messages: newMessages })
    }
  }

  // 単語の意味をポップアップ表示（セッション内キャッシュ）。
  async function lookupWord(word, sentence) {
    const key = word.toLowerCase()
    if (wordCacheRef.current.has(key)) {
      setPopup({ word, meaning: wordCacheRef.current.get(key) })
      return
    }
    setPopup({ word, loading: true })
    const cfg = await getApiConfig()
    if (!cfg.provider || !cfg.apiKey) {
      setPopup({ word, error: "APIキーが未設定です" })
      return
    }
    try {
      const { meaning } = await wordMeaning({ provider: cfg.provider, apiKey: cfg.apiKey, model: cfg.model, word, sentence })
      wordCacheRef.current.set(key, meaning)
      setPopup({ word, meaning })
    } catch (e) {
      setPopup({ word, error: e?.message || "取得に失敗しました" })
    }
  }

  return (
    <div style={{ height: "100vh", maxWidth: "400px", margin: "0 auto", background: COLORS.bg, display: "flex", flexDirection: "column", paddingBottom: "60px", boxSizing: "border-box" }}>
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: "10px", background: "#fff", borderBottom: `1px solid ${COLORS.line}` }}>
        <button onClick={() => router.push("/talk")} style={{ background: "none", border: "none", fontSize: "16px", fontWeight: "bold", color: COLORS.text, cursor: "pointer" }}>◀</button>
        <div style={{ fontSize: "15px", fontWeight: "bold", color: COLORS.text }}>{chat.title || "おしゃべり"}</div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {chat.messages.length === 0 && !streaming && (
          <div style={{ textAlign: "center", color: COLORS.muted, fontSize: "13px", marginTop: "20px", lineHeight: 1.8 }}>
            日本語でOK！<br />「今日は疲れたよ」みたいに話しかけてみよう。
            <div style={{ fontSize: "11px", marginTop: "16px", lineHeight: 1.7 }}>
              ※メッセージはあなたのAPIキーでAIに送信されます。<br />個人情報や見られたくない内容は入力しないでください。
            </div>
          </div>
        )}

        {chat.messages.map((m, idx) =>
          m.role === "user" ? (
            <UserBubble key={idx} message={m} messageIdx={idx} onRefine={refineFor} />
          ) : (
            <AiBubble
              key={idx}
              message={m}
              messageIdx={idx}
              onTranslate={translateFor}
              onWord={lookupWord}
            />
          )
        )}

        {streaming && <AiBubble message={{ content: streamingText }} live />}

        {error && <ErrorNotice error={error} compact />}
      </div>

      <div style={{ padding: "10px 12px", background: "transparent", display: "flex", gap: "8px", alignItems: "flex-end" }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder="日本語でOK！話しかけてみよう"
          rows={1}
          style={{ flex: 1, padding: "11px 12px", borderRadius: "18px", border: `1px solid ${COLORS.line}`, fontSize: "15px", resize: "none", maxHeight: "100px", lineHeight: 1.4 }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || streaming}
          style={{ flex: "none", width: "56px", height: "44px", borderRadius: "22px", border: "none", background: !input.trim() || streaming ? "#ccc" : "#333333", color: "#fff", fontSize: "18px", fontWeight: "bold", cursor: !input.trim() || streaming ? "default" : "pointer" }}
        >
          {streaming ? "…" : "▶"}
        </button>
      </div>

      <Navigation />

      {/* 単語意味ポップアップ */}
      {popup && (
        <div onClick={() => setPopup(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: "16px 16px 0 0", padding: "18px 20px 26px", width: "100%", maxWidth: "480px", boxShadow: "0 -4px 20px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <span style={{ fontSize: "18px", fontWeight: "bold", color: COLORS.text }}>{popup.word}</span>
              <button onClick={() => playWebSpeech(popup.word)} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 0 0", opacity: 0.7 }} aria-label="読み上げ"><img src="/images/icons/speaker-333.svg" alt="読み上げ" style={{ width: "18px", height: "18px", display: "block" }} /></button>
              <button onClick={() => setPopup(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: COLORS.muted, fontSize: "20px", cursor: "pointer" }}>×</button>
            </div>
            <div style={{ fontSize: "15px", color: popup.error ? COLORS.danger : COLORS.text, lineHeight: 1.6 }}>
              {popup.loading ? "調べています…" : popup.error ? popup.error : popup.meaning}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function UserBubble({ message, messageIdx, onRefine }) {
  const [open, setOpen] = useState(false)
  const en = message.en
  const isJa = /[぀-ヿ㐀-鿿ｦ-ﾟ]/.test(message.content)
  const label = isJa ? "英語で言うと" : "自然な言い方"

  function toggle() {
    setOpen((prev) => {
      const next = !prev
      if (next && en === undefined && onRefine) onRefine(messageIdx, message.content)
      return next
    })
  }

  return (
    <div style={{ alignSelf: "flex-end", maxWidth: "80%", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
      <div style={{ background: COLORS.primarySoft, border: `1px solid ${COLORS.primary}`, borderRadius: "16px 16px 4px 16px", padding: "10px 14px", fontSize: "15px", color: COLORS.text, whiteSpace: "pre-wrap", display: "flex", alignItems: "flex-start", gap: "8px" }}>
        <span style={{ flex: 1 }}>{message.content}</span>
        <button onClick={toggle} style={{ flex: "none", background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#333333", fontWeight: "bold", padding: "0 2px" }} aria-label="英語で表示">
          {open ? "▲" : "▼"}
        </button>
      </div>
      {open && (
        <div style={{ marginTop: "4px", maxWidth: "100%", background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: "12px", padding: "8px 12px" }}>
          <div style={{ fontSize: "11px", color: COLORS.muted, marginBottom: "2px" }}>{label}</div>
          {en === undefined ? (
            <div style={{ fontSize: "14px", color: COLORS.muted }}>英語にしています…</div>
          ) : (
            <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
              <button onClick={() => playWebSpeech(en)} style={{ flex: "none", background: "none", border: "none", cursor: "pointer", padding: "2px 0 0", opacity: 0.7 }} aria-label="読み上げ"><img src="/images/icons/speaker-333.svg" alt="読み上げ" style={{ width: "16px", height: "16px", display: "block" }} /></button>
              <span style={{ fontSize: "15px", color: COLORS.text, lineHeight: 1.6 }}>{en}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AiBubble({ message, messageIdx, live, onTranslate, onWord }) {
  const sentences = splitSentences(message.content)
  const [open, setOpen] = useState(() => new Set())
  const tr = message.tr || {}

  function toggle(i, s) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(i)) {
        next.delete(i)
      } else {
        next.add(i)
        if (tr[i] === undefined && onTranslate) onTranslate(messageIdx, i, s)
      }
      return next
    })
  }

  return (
    <div style={{ alignSelf: "flex-start", maxWidth: "88%", background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: "16px 16px 16px 4px", padding: "12px 14px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      {sentences.length === 0 && live ? (
        <span style={{ color: COLORS.muted }}>…</span>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {sentences.map((s, i) => (
            <div key={i}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                <button onClick={() => playWebSpeech(s)} style={{ flex: "none", background: "none", border: "none", cursor: "pointer", padding: "2px 0 0", opacity: 0.7 }} aria-label="読み上げ"><img src="/images/icons/speaker-333.svg" alt="読み上げ" style={{ width: "16px", height: "16px", display: "block" }} /></button>
                <span style={{ fontSize: "15px", color: COLORS.text, lineHeight: 1.6, flex: 1 }}>
                  {live ? s : <Words text={s} onWord={(w) => onWord(w, s)} />}
                </span>
                {!live && (
                  <button onClick={() => toggle(i, s)} style={{ flex: "none", background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#333333", fontWeight: "bold", padding: "0 2px" }}>
                    {open.has(i) ? "▲" : "▼"}
                  </button>
                )}
              </div>
              {!live && open.has(i) && (
                <div style={{ marginTop: "4px", marginLeft: "24px", fontSize: "13px", color: COLORS.sub, lineHeight: 1.6 }}>
                  {tr[i] !== undefined ? tr[i] : "訳しています…"}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// 単語ごとにタップ可能にする（空白は保持、記号は表示のまま・照会時に除去）
function Words({ text, onWord }) {
  const parts = text.split(/(\s+)/)
  return parts.map((p, i) => {
    if (/^\s+$/.test(p) || p === "") return <span key={i}>{p}</span>
    const clean = p.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, "")
    if (!clean) return <span key={i}>{p}</span>
    return (
      <span
        key={i}
        onClick={() => onWord(clean)}
        style={{ cursor: "pointer", borderBottom: "1px dotted #c3ccdf" }}
      >
        {p}
      </span>
    )
  })
}

const backBtn = { marginTop: 16, padding: "12px 30px", borderRadius: "999px", border: "none", background: COLORS.text, color: "#fff", fontWeight: "bold", cursor: "pointer" }

function Center({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", textAlign: "center", color: COLORS.sub }}>
      {children}
    </div>
  )
}
