// 使用するAIモデルの一元管理。
// サーバー側（lib/llm.js の呼び出し）とクライアント側（pages/help.jsx の表示）の
// 両方がここを参照するため、モデル変更はこの1ファイルだけで済む。
//
// 注意: GEMINI_MODEL は NEXT_PUBLIC_ ではないためクライアントでは undefined になり、
// help.jsx の表示は常にフォールバック値（下記の既定モデル）になる。実際のAPI呼び出し
// （サーバー側）では環境変数の上書きが有効。表示と実挙動を完全一致させたい場合は
// GEMINI_MODEL を使わず、この定数を直接書き換える運用にすること。
export const DEFAULT_MODELS = {
  claude: "claude-haiku-4-5",
  openai: "gpt-5.4-mini",
  gemini: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
}
