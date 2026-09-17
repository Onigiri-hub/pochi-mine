// 並べ替え練習（Pochi本家 arrangePractice の見た目・効果音・出題形式に寄せた版）。
// 単文＋Web Speech対応：出題時に英語を自動再生（リスニング先行）＋🔊で再生。
// 効果音: チップ=pa.mp3 / 正解=seikai.mp3。見た目は本家（灰チップ・点線box・下部バー）。
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/router"
import { getWord, getSentencesByWord, updateWord } from "../lib/store"
import { checkAnswer, shuffle, toChipTokens } from "../lib/practice"
import { preloadVoices, warmUpSpeech, playWebSpeech } from "../utils/ttsPlayer"
import CompleteScreen from "../components/CompleteScreen"
import Navigation from "../components/Navigation"
import { COLORS, primaryBtn } from "../lib/ui"

export default function Practice() {
  const router = useRouter()

  const [wordIds, setWordIds] = useState([])
  const [sentences, setSentences] = useState(null) // null=読込中
  const [i, setI] = useState(0)
  const [pool, setPool] = useState([])
  const [placed, setPlaced] = useState([])
  const [status, setStatus] = useState("playing") // playing | correct | wrong
  const [finished, setFinished] = useState(false)

  const paRef = useRef(null)
  const seikaiRef = useRef(null)

  useEffect(() => {
    preloadVoices()
    paRef.current = new Audio("/sound/pa.mp3")
    paRef.current.volume = 0.3
    seikaiRef.current = new Audio("/sound/seikai.mp3")
    seikaiRef.current.playbackRate = 1.5
    seikaiRef.current.volume = 0.5
  }, [])

  useEffect(() => {
    if (!router.isReady) return
    const q = router.query
    const ids = q.wordIds ? String(q.wordIds).split(",").filter(Boolean) : q.wordId ? [String(q.wordId)] : []
    if (ids.length === 0) {
      setWordIds([])
      setSentences([])
      return
    }
    ;(async () => {
      const sentsArr = await Promise.all(ids.map(getSentencesByWord))
      setWordIds(ids)
      setSentences(sentsArr.flat())
    })()
  }, [router.isReady, router.query])

  // 各問セットアップ
  useEffect(() => {
    if (!sentences || sentences.length === 0) return
    const cur = sentences[i]
    if (!cur) return
    setPool(shuffle(toChipTokens(cur.chips)))
    setPlaced([])
    setStatus("playing")
  }, [sentences, i])

  // 出題時に英語を自動再生（リスニング先行）
  useEffect(() => {
    if (!sentences || !sentences[i]) return
    const t = setTimeout(() => playWebSpeech(sentences[i].en), 500)
    return () => clearTimeout(t)
  }, [sentences, i])

  function playPa() {
    if (!paRef.current) return
    paRef.current.currentTime = 0
    paRef.current.play().catch(() => {})
  }

  if (sentences === null) return <Center>読み込み中…</Center>
  if (sentences.length === 0) {
    return (
      <Center>
        <div>出題できる例文がありませんでした。</div>
        <button onClick={() => router.push("/words")} style={{ ...primaryBtn(false), marginTop: 16, padding: "12px 30px" }}>単語一覧へ</button>
      </Center>
    )
  }

  const cur = sentences[i]

  function pick(chip) {
    if (status === "correct") return
    warmUpSpeech()
    playPa()
    setPlaced((p) => [...p, chip])
    setPool((p) => p.filter((c) => c.id !== chip.id))
    setStatus("playing")
  }
  function unpick(chip) {
    if (status === "correct") return
    playPa()
    setPlaced((p) => p.filter((c) => c.id !== chip.id))
    setPool((p) => [...p, chip])
    setStatus("playing")
  }
  function check() {
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
  async function next() {
    if (i + 1 >= sentences.length) {
      for (const id of wordIds) await updateWord(id, { done: true })
      setFinished(true)
    } else {
      setI(i + 1)
    }
  }

  if (finished) {
    return <CompleteScreen onNext={() => router.push("/words")} />
  }

  return (
    <div className="app">
      {/* ヘッダー（戻る） */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
        <button onClick={() => router.push("/words")} style={{ background: "none", border: "none", fontSize: "16px", fontWeight: "bold", color: "#333", cursor: "pointer" }}>◀</button>
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
          <button key={c.id} className="chip" onClick={() => unpick(c)}>{c.token}</button>
        ))}
      </div>

      {/* チップ供給 */}
      <div style={{ textAlign: "center" }}>
        {pool.map((c) => (
          <button key={c.id} className="chip" onClick={() => pick(c)}>{c.token}</button>
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

function Center({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", textAlign: "center", color: COLORS.sub }}>
      {children}
    </div>
  )
}
