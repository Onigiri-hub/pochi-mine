// 常時表示のトークン使用量バッジ（右上固定）。
// 今日（JST）の合計と、設定した1日の上限（目安）を表示。上限に近づくと色が変わる。
import { useEffect, useState } from "react"
import { useRouter } from "next/router"
import { getTodayUsage, getSettings } from "../lib/store"
import { COLORS } from "../lib/ui"

// 大きな数を読みやすく（1,500→1.5k, 1,200,000→1.2M）
function fmtTokens(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "") + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "") + "k"
  return String(n)
}

export default function TokenMeter() {
  const router = useRouter()
  const [used, setUsed] = useState(null)
  const [requests, setRequests] = useState(0)
  const [limit, setLimit] = useState(0)
  const [reqLimit, setReqLimit] = useState(0)

  async function load() {
    try {
      const [u, s] = await Promise.all([getTodayUsage(), getSettings()])
      setUsed(u.total)
      setRequests(u.requests || 0)
      setLimit(s.dailyTokenLimit || 0)
      setReqLimit(s.dailyRequestLimit || 0)
    } catch {}
  }

  useEffect(() => {
    load()
    const onEvt = () => load()
    window.addEventListener("pm:usage", onEvt)
    window.addEventListener("pm:settings", onEvt)
    router.events?.on?.("routeChangeComplete", load)
    return () => {
      window.removeEventListener("pm:usage", onEvt)
      window.removeEventListener("pm:settings", onEvt)
      router.events?.off?.("routeChangeComplete", load)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (used === null) return null

  const tokOver = limit > 0 && used >= limit
  const tokWarn = limit > 0 && used >= limit * 0.8
  const reqOver = reqLimit > 0 && requests >= reqLimit
  const reqWarn = reqLimit > 0 && requests >= reqLimit * 0.8

  const tokColor = tokOver ? COLORS.danger : tokWarn ? "#e0902c" : COLORS.sub
  const tokBar = tokOver ? COLORS.danger : tokWarn ? "#e0902c" : COLORS.primary
  const reqColor = reqOver ? COLORS.danger : reqWarn ? "#e0902c" : COLORS.muted
  const reqBar = reqOver ? COLORS.danger : reqWarn ? "#e0902c" : COLORS.primary
  const tokPct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const reqPct = reqLimit > 0 ? Math.min(100, (requests / reqLimit) * 100) : 0

  const bar = (pct, col) => (
    <div style={{ height: "4px", background: "#eee", borderRadius: "999px", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: col }} />
    </div>
  )

  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        right: 8,
        zIndex: 2000,
        background: "rgba(255,255,255,0.95)",
        border: `1px solid ${tokOver || reqOver ? COLORS.danger : COLORS.line}`,
        borderRadius: "12px",
        padding: "5px 10px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
        fontSize: "11px",
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        minWidth: "84px",
      }}
      title="今日の使用量（JST0時にリセット）"
    >
      <div style={{ fontWeight: "bold", whiteSpace: "nowrap", color: tokColor }}>
        🔸 {fmtTokens(used)}{limit > 0 ? ` / ${fmtTokens(limit)}` : ""} tok
      </div>
      {limit > 0 && bar(tokPct, tokBar)}
      <div style={{ fontWeight: "bold", whiteSpace: "nowrap", color: reqColor }}>
        📨 {fmtTokens(requests)}{reqLimit > 0 ? ` / ${fmtTokens(reqLimit)}` : ""} 回
      </div>
      {reqLimit > 0 && bar(reqPct, reqBar)}
    </div>
  )
}
