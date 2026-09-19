// MY長文の再生。プレビュー（英文/和訳トグル＋全文リスニング）→ 並べ替え → 完了。
// 並べ替えは「並べて英単語」のレッスン画面(practice.jsx)と同じ見た目・効果音・挙動に統一。
// 出題時に英語を一度だけ自動再生（リスニング先行）／解答後の読み上げは無し。
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/router"
import { getStory, updateStory, getApiConfig } from "../lib/store"
import { wordMeaning } from "../lib/api"
import { lookupDictionary } from "../lib/dictionary"
import { checkAnswer, shuffle, toChipTokens } from "../lib/practice"
import { preloadVoices, warmUpSpeech, playWebSpeech, playAllWebSpeech } from "../utils/ttsPlayer"
import CompleteScreen from "../components/CompleteScreen"
import Navigation from "../components/Navigation"
import { COLORS, primaryBtn } from "../lib/ui"

export default function StoryPlay() {
  const router = useRouter()
  const { id } = router.query

  const [story, setStory] = useState(undefined) // undefined=読込中, null=見つからない
  const [phase, setPhase] = useState("preview") // preview | arrange | done
  const [showEn, setShowEn] = useState(false)
  const [showJa, setShowJa] = useState(false)
  const [listening, setListening] = useState(false)
  const cancelListenRef = useRef(null)

  // 並べ替え
  const [i, setI] = useState(0)
  const [pool, setPool] = useState([])
  const [placed, setPlaced] = useState([])
  const [status, setStatus] = useState("playing") // playing | correct | wrong
  const [popup, setPopup] = useState(null) // { word, meaning?, loading?, error? }

  const paRef = useRef(null)
  const seikaiRef = useRef(null)
  const wordCacheRef = useRef(new Map()) // 単語意味の一時キャッシュ（セッション内）
  const pressTimerRef = useRef(null) // 長押し判定タイマー
  const pressFiredRef = useRef(false) // 長押しが発火したか（直後のclickを無視するため）

  useEffect(() => {
    preloadVoices()
    paRef.current = new Audio("/sound/pa.mp3")
    paRef.current.volume = 0.3
    seikaiRef.current = new Audio("/sound/seikai.mp3")
    seikaiRef.current.playbackRate = 1.5
    seikaiRef.current.volume = 0.5
  }, [])

  useEffect(() => {
    if (!id) return
    getStory(id).then((s) => setStory(s || null))
  }, [id])

  const sentences = story?.sentences || []

  // 各問セットアップ
  useEffect(() => {
    if (phase !== "arrange" || sentences.length === 0) return
    const cur = sentences[i]
    if (!cur) return
    setPool(shuffle(toChipTokens(cur.chips)))
    setPlaced([])
    setStatus("playing")
  }, [phase, i, story])

  // 出題時に英語を一度だけ自動再生（リスニング先行）
  useEffect(() => {
    if (phase !== "arrange" || !sentences[i]) return
    const t = setTimeout(() => playWebSpeech(sentences[i].en), 500)
    return () => clearTimeout(t)
  }, [phase, i, story])

  useEffect(() => {
    return () => {
      if (cancelListenRef.current) cancelListenRef.current()
    }
  }, [])

  if (story === undefined) return <Center>読み込み中…</Center>
  if (story === null) {
    return (
      <Center>
        <div>長文が見つかりませんでした。</div>
        <button onClick={() => router.push("/myStory")} style={{ ...primaryBtn(false), marginTop: 16, padding: "12px 30px" }}>一覧へ</button>
      </Center>
    )
  }

  function toggleListen() {
    warmUpSpeech()
    if (listening) {
      if (cancelListenRef.current) cancelListenRef.current()
      setListening(false)
      return
    }
    setListening(true)
    cancelListenRef.current = playAllWebSpeech(
      sentences.map((s) => s.en),
      { onDone: () => setListening(false) }
    )
  }

  function startArrange() {
    if (cancelListenRef.current) cancelListenRef.current()
    setListening(false)
    warmUpSpeech()
    setPhase("arrange")
  }

  // ===== プレビュー =====
  if (phase === "preview") {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.bg, paddingBottom: "40px" }}>
        <div style={{ padding: "10px 20px" }}>
          <button onClick={() => router.push("/myStory")} style={{ background: "none", border: "none", fontSize: "15px", fontWeight: "bold", color: COLORS.text, cursor: "pointer" }}>◀</button>
        </div>

        <div style={{ textAlign: "center", fontSize: "20px", fontWeight: "bold", color: COLORS.text, margin: "8px 0 26px" }}>
          {story.title || "MY長文"}
          <span onClick={toggleListen} style={{ marginLeft: "10px", cursor: "pointer", display: "inline-flex", verticalAlign: "middle", opacity: 0.75 }} aria-label="全文を再生">
            {listening ? <span style={{ fontSize: "18px" }}>⏸</span> : <img src="/images/icons/speaker-333.svg" alt="全文を再生" style={{ width: "20px", height: "20px", verticalAlign: "middle" }} />}
          </span>
        </div>

        <div style={{ maxWidth: "400px", margin: "0 auto", padding: "0 20px", display: "flex", flexDirection: "column" }}>
          <Toggle label="英文表示" open={showEn} onClick={() => setShowEn((v) => !v)} />
          {showEn && (
            <div style={reveal}>{sentences.map((s, k) => <span key={k}>{s.en} </span>)}</div>
          )}
          <Toggle label="日本語表示" open={showJa} onClick={() => setShowJa((v) => !v)} mt={34} />
          {showJa && (
            <div style={reveal}>{sentences.map((s) => s.ja).join("")}</div>
          )}
        </div>

        <div style={{ maxWidth: "400px", margin: "30px auto 0", padding: "0 20px" }}>
          <button onClick={startArrange} style={{ ...primaryBtn(false), width: "100%", background: "#333333" }}>
            学習開始！
          </button>
        </div>
      </div>
    )
  }

  // ===== 完了 =====
  if (phase === "done") {
    return <CompleteScreen onNext={() => router.push("/myStory")} />
  }

  // ===== 並べ替え（practice.jsx と同じ見た目・効果音・挙動）=====
  const cur = sentences[i]

  function playPa() {
    if (!paRef.current) return
    paRef.current.currentTime = 0
    paRef.current.play().catch(() => {})
  }

  const pick = (chip) => {
    if (status === "correct") return
    warmUpSpeech()
    playPa()
    setPlaced((p) => [...p, chip])
    setPool((p) => p.filter((c) => c.id !== chip.id))
    setStatus("playing")
  }
  const unpick = (chip) => {
    if (status === "correct") return
    playPa()
    setPlaced((p) => p.filter((c) => c.id !== chip.id))
    setPool((p) => [...p, chip])
    setStatus("playing")
  }
  // --- チップ長押しで意味ポップアップ ---
  const lookupWord = async (rawWord) => {
    const word = rawWord.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, "") || rawWord
    const key = word.toLowerCase()
    if (wordCacheRef.current.has(key)) {
      setPopup({ word, ...wordCacheRef.current.get(key) })
      return
    }
    setPopup({ word, loading: true })
    // ① まずローカル辞書（ヒットすればAPIを叩かない）
    const dictJa = await lookupDictionary(word)
    if (dictJa) {
      const entry = { meaning: dictJa, source: "dict" }
      wordCacheRef.current.set(key, entry)
      setPopup({ word, ...entry })
      return
    }
    // ② 辞書に無ければAPI（文脈依存）
    const cfg = await getApiConfig()
    if (!cfg.provider || !cfg.apiKey) {
      setPopup({ word, error: "APIキーが未設定です。設定画面で登録してください。" })
      return
    }
    try {
      const { meaning } = await wordMeaning({ provider: cfg.provider, apiKey: cfg.apiKey, model: cfg.model, word, sentence: cur.en })
      const entry = { meaning, source: "ai" }
      wordCacheRef.current.set(key, entry)
      setPopup({ word, ...entry })
    } catch (e) {
      setPopup({ word, error: e?.message || "取得に失敗しました" })
    }
  }
  const pressStart = (chip) => {
    pressFiredRef.current = false
    clearTimeout(pressTimerRef.current)
    pressTimerRef.current = setTimeout(() => {
      pressFiredRef.current = true
      lookupWord(chip.token)
    }, 500)
  }
  const pressEnd = () => clearTimeout(pressTimerRef.current)
  // 長押しが発火していたら直後のclick（pick/unpick）は無視する
  const chipTap = (chip, tapFn) => {
    if (pressFiredRef.current) {
      pressFiredRef.current = false
      return
    }
    tapFn(chip)
  }

  const check = () => {
    const assembled = placed.map((c) => c.token).join(" ")
    if (checkAnswer(assembled, cur.answer)) {
      if (seikaiRef.current) {
        seikaiRef.current.currentTime = 0
        seikaiRef.current.play().catch(() => {})
      }
      setStatus("correct")
    } else {
      setStatus("wrong")
    }
  }
  const next = async () => {
    if (i + 1 >= sentences.length) {
      await updateStory(id, { done: true })
      setPhase("done")
    } else {
      setI(i + 1)
    }
  }

  return (
    <div className="app">
      {/* ヘッダー（戻る＝プレビューへ） */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
        <button onClick={() => setPhase("preview")} style={{ background: "none", border: "none", fontSize: "16px", fontWeight: "bold", color: "#333", cursor: "pointer" }}>◀</button>
        <span style={{ marginLeft: "auto", fontSize: "12px", color: "#aaa" }}>{i + 1} / {sentences.length}</span>
      </div>

      {/* 進捗ドット */}
      <div className="progressDots">
        {sentences.map((_, k) => (
          <div key={k} className={k === i ? "dot active" : "dot"} />
        ))}
      </div>

      {/* 出題（ポチ＋吹き出し） */}
      <div className="chat left">
        <div className="iconContainer">
          <img src="/images/illustrations/pochi.png" alt="ポチ" className="characterIcon" />
        </div>
        <div className="bubble">
          <div className="prompt">
            <span className="audioBtn" onClick={() => playWebSpeech(cur.en)}>
              <img src="/images/icons/speaker-333.svg" alt="音声を再生" />
            </span>
            {cur.ja || "（訳なし）"}
          </div>
          {status === "correct" && <div className="en">{cur.en}</div>}
        </div>
      </div>

      {/* 解答エリア */}
      <div className="chipBox">
        {placed.map((c) => (
          <button key={c.id} className="chip"
            onPointerDown={() => pressStart(c)} onPointerUp={pressEnd} onPointerLeave={pressEnd} onPointerCancel={pressEnd}
            onContextMenu={(e) => e.preventDefault()}
            onClick={() => chipTap(c, unpick)}>{c.token}</button>
        ))}
      </div>

      {/* チップ供給 */}
      <div style={{ textAlign: "center" }}>
        {pool.map((c) => (
          <button key={c.id} className="chip"
            onPointerDown={() => pressStart(c)} onPointerUp={pressEnd} onPointerLeave={pressEnd} onPointerCancel={pressEnd}
            onContextMenu={(e) => e.preventDefault()}
            onClick={() => chipTap(c, pick)}>{c.token}</button>
        ))}
      </div>

      {/* 下部バー */}
      <div className={`bottomArea ${status !== "playing" ? status : ""}`}>
        {status === "correct" && <div className="resultText">Perfect！</div>}
        {status === "wrong" && <div className="resultText">惜しい！</div>}
        <button
          className="mainButton"
          disabled={status === "playing" && placed.length === 0}
          onClick={status === "correct" ? next : status === "wrong" ? () => setStatus("playing") : check}
        >
          {status === "correct" ? "Next" : status === "wrong" ? "Try again" : "Check"}
        </button>
      </div>

      <Navigation />

      {/* 単語意味ポップアップ（チップ長押し） */}
      {popup && (
        <div onClick={() => setPopup(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: "16px 16px 0 0", padding: "18px 20px 26px", width: "100%", maxWidth: "480px", boxShadow: "0 -4px 20px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <span style={{ fontSize: "18px", fontWeight: "bold", color: "#333" }}>{popup.word}</span>
              <button onClick={() => playWebSpeech(popup.word)} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 0 0", opacity: 0.7 }} aria-label="読み上げ"><img src="/images/icons/speaker-333.svg" alt="読み上げ" style={{ width: "18px", height: "18px", display: "block" }} /></button>
              <button onClick={() => setPopup(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#999", fontSize: "20px", cursor: "pointer" }}>×</button>
            </div>
            <div style={{ fontSize: "15px", color: popup.error ? COLORS.danger : "#333", lineHeight: 1.6 }}>
              {popup.loading ? "調べています…" : popup.error ? popup.error : popup.meaning}
            </div>
            {!popup.loading && !popup.error && popup.source && (
              <div style={{ fontSize: "10px", color: "#bbb", marginTop: "8px", textAlign: "right" }}>{popup.source === "dict" ? "辞書" : "AI"}</div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .app {
          max-width: 400px;
          margin: auto;
          padding: 16px 20px 240px;
          min-height: 100vh;
          background: #ebebeb;
        }
        .progressDots {
          display: flex;
          justify-content: center;
          gap: 8px;
          padding: 5px 0 10px;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ddd;
        }
        .dot.active {
          background: #02ccbb;
        }
        .chat {
          display: flex;
          align-items: flex-start;
          margin: 24px 0;
        }
        .iconContainer :global(.characterIcon) {
          width: 60px;
          height: 60px;
          object-fit: contain;
          margin-right: 15px;
        }
        .bubble {
          position: relative;
          background: #fff;
          padding: 15px 16px;
          border-radius: 20px;
          max-width: 75%;
          line-height: 1.5;
        }
        .bubble::before {
          content: "";
          position: absolute;
          left: -10px;
          top: 14px;
          width: 0;
          height: 0;
          border-bottom: 10px solid transparent;
          border-right: 15px solid #fff;
        }
        .prompt {
          color: #333;
          font-size: 16px;
          font-weight: bold;
        }
        .en {
          color: #000;
          font-weight: 800;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px dashed #ddd;
        }
        .audioBtn {
          cursor: pointer;
          margin-right: 6px;
          opacity: 0.7;
        }
        .audioBtn :global(img) {
          width: 1em;
          height: 1em;
          vertical-align: -0.15em;
        }
        .chipBox {
          min-height: 70px;
          border: 3px dotted #a0a0a0;
          background: #f0f0f0;
          border-radius: 12px;
          padding: 10px;
          margin: 22px 0;
          text-align: center;
        }
        .chip {
          padding: 10px 14px;
          margin: 6px;
          border-radius: 20px;
          border: none;
          background: #969696;
          color: #fff;
          font-size: 16px;
          cursor: pointer;
          transition: transform 0.1s;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }
        .chip:active {
          transform: translateY(-6px) scale(1.05);
        }
        .bottomArea {
          position: fixed;
          bottom: 60px;
          left: 50%;
          transform: translateX(-50%);
          width: 100%;
          max-width: 400px;
          background: #ebebeb;
          padding: 16px 20px 18px;
          display: flex;
          flex-direction: column;
          align-items: center;
          transition: 0.2s;
          box-sizing: border-box;
        }
        .bottomArea.correct {
          background: #02ccbb;
          color: #fff;
        }
        .bottomArea.wrong {
          background: #ff9600;
          color: #fff;
        }
        .resultText {
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .mainButton {
          width: 300px;
          max-width: 100%;
          padding: 16px;
          border-radius: 40px;
          border: none;
          font-size: 18px;
          font-weight: bold;
          cursor: pointer;
          background: #555;
          color: #fff;
        }
        .mainButton:disabled {
          background: #bbb;
          cursor: default;
        }
        .bottomArea.correct .mainButton {
          background: #fff;
          color: #02ccbb;
        }
        .bottomArea.wrong .mainButton {
          background: #fff;
          color: #ff9600;
        }
      `}</style>
    </div>
  )
}

function Toggle({ label, open, onClick, mt = 0 }) {
  return (
    <div onClick={onClick} style={{ textAlign: "center", cursor: "pointer", fontSize: "17px", fontWeight: "bold", color: COLORS.text, padding: "4px 0 0", marginTop: mt }}>
      {label}　{open ? "▲" : "▼"}
      <img src="/images/illustrations/section_underbar.png" alt="" style={{ display: "block", width: "100%", height: "auto", marginTop: "2px", pointerEvents: "none" }} />
    </div>
  )
}

function Center({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", textAlign: "center", color: COLORS.sub }}>
      {children}
    </div>
  )
}

// 英文/和訳の表示（背景なし・線画像より内側に収める）
const reveal = { fontSize: "16px", lineHeight: 1.7, color: COLORS.text, padding: "4px 34px 10px", textAlign: "left" }
