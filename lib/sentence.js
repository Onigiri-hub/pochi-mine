// 文オブジェクトの生成ヘルパー。
// プロキシは {en,ja} だけ返すので、クライアント側で並べ替えに必要な形へ膨らませる。

// 一意ID（ブラウザの crypto.randomUUID を優先、無ければフォールバック）
export function uid(prefix) {
  const rand =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
  return `${prefix}_${rand}`
}

export function normalize(s) {
  return (s || "").replace(/\s+/g, " ").trim()
}

// 並べ替えの選択肢（chips）: 答えを空白で割って「|」結合（Pochi-next の toChips と同形）
export function toChips(answer) {
  return normalize(answer).split(/\s+/).filter(Boolean).join("|")
}

// 英文をざっくり文単位に分割（チャットの一文ずつ表示用）。
export function splitSentences(text) {
  return (text || "")
    .replace(/([.!?])\s+/g, "$1\n")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
}

// {en,ja} → フル文オブジェクト {id,en,ja,answer,chips,audio:null}
// audio は常に null（再生時に Web Speech で読む）。
export function buildSentence({ en, ja }) {
  const e = normalize(en)
  return {
    id: uid("sen"),
    en: e,
    ja: normalize(ja),
    answer: e,
    chips: toChips(e),
    audio: null,
  }
}
