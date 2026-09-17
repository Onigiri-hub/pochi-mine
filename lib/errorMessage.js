// クライアント側のエラー分類。
// lib/api.js が投げる Error（.code, .status, .message＝サーバーの日本語detail）と、
// 通信断（fetch が reject＝.code を持たない）を、ユーザー向けの {code,title,message,action?} に変換する。
// サーバーが用意した日本語メッセージ(e.message)があれば尊重しつつ、タイトルと操作導線(action)を足す。

export function describeError(e) {
  const code = e?.code
  const online = typeof navigator === "undefined" || navigator.onLine

  // 通信断：我々が投げる Error は必ず code を持つので、code が無い＝サーバー応答前に失敗した可能性。
  if (!code) {
    if (!online) {
      return { code: "offline", title: "オフラインのようです", message: "インターネット接続を確認して、もう一度お試しください。" }
    }
    if (e?.name === "TypeError") {
      return { code: "network", title: "通信できませんでした", message: "接続状況を確認して、もう一度お試しください。" }
    }
  }

  switch (code) {
    case "invalid_key":
    case "missing_api_key":
      return {
        code,
        title: "APIキーを確認してください",
        message: e?.message || "APIキーが正しくないようです。設定画面で確認してください。",
        action: { label: "設定を開く", href: "/settings" },
      }
    case "content_blocked":
      return { code, title: "この内容では作成できません", message: e?.message || "表現を見直して、もう一度お試しください。" }
    case "rate_limited":
      // サーバーが「自前のレート制限」と「AI提供元のレート上限」で文言を出し分けているので e.message を優先。
      return { code, title: "少し時間をおいてください", message: e?.message || "アクセスが集中しています。少し待って、もう一度お試しください。" }
    case "unavailable":
      return { code, title: "混み合っています", message: e?.message || "少し時間をおいて、もう一度お試しください。" }
    case "server_error":
      return { code, title: "エラーが発生しました", message: "時間をおいて、もう一度お試しください。" }
    default:
      return { code: code || "unknown", title: null, message: e?.message || "うまくいきませんでした。もう一度お試しください。" }
  }
}
