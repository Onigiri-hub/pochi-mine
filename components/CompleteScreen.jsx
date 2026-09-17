// レッスン完了画面（本家式・簡易版）。アニメーション＋効果音＋「次へ」だけ。
// モフ/バッジ等は無し。onNext で戻り先を指定する。
import { useEffect } from "react"
import Navigation from "./Navigation"

export default function CompleteScreen({ onNext, label = "次へ" }) {
  useEffect(() => {
    const a = new Audio("/sound/kirakira.mp3")
    a.volume = 0.2
    a.play().catch(() => {})
  }, [])

  return (
    <div style={{ minHeight: "100vh", background: "#ebebeb", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 24px 84px" }}>
      <video src="/animations/animation-great.mp4" autoPlay muted playsInline style={{ width: "70%", maxWidth: "320px" }} />
      <button
        onClick={onNext}
        style={{ marginTop: "28px", width: "280px", maxWidth: "90%", padding: "16px", borderRadius: "40px", border: "none", background: "#02ccbb", color: "#fff", fontSize: "18px", fontWeight: "bold", cursor: "pointer" }}
      >
        {label}
      </button>
      <Navigation />
    </div>
  )
}
