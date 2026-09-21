// バックアップを促すポップアップ。
//   - 初回（context="settings"）: 設定画面を開いたとき「バックアップのススメ」を1回だけ。OKで閉じるだけ。
//   - 2回目以降（context="app"）: アプリ起動時、1週間バックアップが無いときだけ促す。
// 判定・記録はすべて lib/backupReminder.js（localStorage）に集約。
import { useEffect, useState } from "react"
import { useRouter } from "next/router"
import { shouldRemind, markPromptShown } from "../lib/backupReminder"
import { COLORS, primaryBtn, segBtn } from "../lib/ui"

export default function BackupReminder({ context = "app" }) {
  const router = useRouter()
  const [mode, setMode] = useState(null) // "first" | "weekly" | null

  useEffect(() => {
    // マウント時に1回だけ判定。SPA遷移では再マウントされない。
    const m = shouldRemind()
    if (!m) return
    // 初回お知らせは設定画面だけ、週1リマインダーはアプリ起動時だけ担当。
    if (context === "settings" && m !== "first") return
    if (context === "app" && m !== "weekly") return
    setMode(m)
    markPromptShown() // 表示した時点で記録（初回フラグを立て、次回まで1週間あける）
  }, [])

  if (!mode) return null

  const first = mode === "first"
  const title = "バックアップのススメ"
  const body = first
    ? "Pochi-Mine のデータはこの端末の中だけに保存されます。機種変更やブラウザのデータ削除で消えてしまうことがあるので、ときどきバックアップを取っておくと安心です。"
    : "前回のバックアップから1週間以上たっています。大切な学習データを守るために、バックアップを取っておきましょう。"

  const close = () => setMode(null)
  const goBackup = () => {
    close()
    router.push("/backup")
  }

  return (
    <div
      onClick={close}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: "16px",
          padding: "24px 20px 20px",
          maxWidth: "340px",
          width: "100%",
          boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ fontSize: "17px", fontWeight: "bold", color: COLORS.text, textAlign: "center" }}>{title}</div>
        <div style={{ fontSize: "13px", color: COLORS.sub, lineHeight: 1.7, marginTop: "14px" }}>{body}</div>
        {first ? (
          // 初回お知らせ: OKで閉じるだけ（バックアップ導線は出さない）
          <div style={{ marginTop: "22px" }}>
            <button onClick={close} style={{ ...primaryBtn(false), width: "100%", padding: "12px", background: COLORS.primary }}>
              OK
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "10px", marginTop: "22px" }}>
            <button onClick={close} style={{ ...segBtn(false), flex: 1, padding: "12px" }}>
              あとで
            </button>
            <button onClick={goBackup} style={{ ...primaryBtn(false), flex: 1, padding: "12px", background: COLORS.primary }}>
              バックアップする
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
