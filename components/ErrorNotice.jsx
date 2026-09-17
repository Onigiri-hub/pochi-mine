// エラー表示の共通コンポーネント。
// error には lib/api.js が投げた Error オブジェクト、または文字列を渡せる。
// invalid_key など操作導線がある場合は「設定を開く」ボタンを出す。
import { useRouter } from "next/router"
import { COLORS } from "../lib/ui"
import { describeError } from "../lib/errorMessage"

export default function ErrorNotice({ error, compact = false, style }) {
  const router = useRouter()
  if (!error) return null
  const info = typeof error === "string" ? { title: null, message: error, action: null } : describeError(error)

  return (
    <div
      style={{
        background: "#fdecea",
        border: `1px solid ${COLORS.danger}`,
        borderRadius: "10px",
        padding: compact ? "8px 10px" : "10px 12px",
        color: COLORS.danger,
        fontSize: compact ? "12px" : "13px",
        lineHeight: 1.6,
        ...style,
      }}
    >
      {info.title && <div style={{ fontWeight: "bold", marginBottom: "2px" }}>{info.title}</div>}
      <div>{info.message}</div>
      {info.action && (
        <button
          onClick={() => router.push(info.action.href)}
          style={{ marginTop: "8px", background: COLORS.danger, color: "#fff", border: "none", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}
        >
          {info.action.label}
        </button>
      )}
    </div>
  )
}
