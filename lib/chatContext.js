// TALKの翻訳（refine/translate）に渡す「直近の会話」を、プロンプト用の
// 短いトランスクリプト文字列に整形する。日本語は主語省略が多くハイコンテキスト
// なので、単発の1文だけでは正しく訳せない。数ターンの流れを添えて曖昧さを解消する。
// サーバー側の安全弁として最大件数・各発話の文字数もここで制限する。

const MAX_MESSAGES = 6
const MAX_CHARS_PER_MESSAGE = 400

export function formatChatContext(context) {
  if (!Array.isArray(context) || context.length === 0) return ""
  const lines = context
    .filter((m) => m && m.content && String(m.content).trim())
    .slice(-MAX_MESSAGES)
    .map((m) => {
      const who = m.role === "assistant" ? "AI" : "あなた"
      const text = String(m.content).trim().slice(0, MAX_CHARS_PER_MESSAGE)
      return `${who}: ${text}`
    })
  return lines.join("\n")
}
