// Pochi 踏襲の配色・共通スタイル。
export const COLORS = {
  primary: "#e8963c",
  primarySoft: "#fff6ec",
  text: "#333333",
  sub: "#666666",
  muted: "#999999",
  line: "#dddddd",
  bg: "#ebebeb",
  danger: "#d9534f",
  ok: "#3c9a5a",
}

// 丸い主ボタン
export function primaryBtn(disabled) {
  return {
    padding: "14px",
    borderRadius: "999px",
    border: "none",
    fontSize: "16px",
    fontWeight: "bold",
    color: "#fff",
    background: disabled ? "#ccc" : COLORS.text,
    cursor: disabled ? "default" : "pointer",
  }
}

// セグメント（3択・数選択など）
export function segBtn(active) {
  return {
    flex: 1,
    padding: "9px 4px",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "bold",
    color: COLORS.text,
    border: active ? `2px solid ${COLORS.primary}` : `1px solid ${COLORS.line}`,
    background: active ? COLORS.primarySoft : "#fff",
  }
}
