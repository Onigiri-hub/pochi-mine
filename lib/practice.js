// 並べ替え練習のロジック（単文用）。
// checkAnswer は Pochi-next の PracticeEngine と同じ判定（|区切りの許容パターン・大小無視）。

export function checkAnswer(userAnswer, correctPatterns) {
  return (correctPatterns || "").split("|").some(
    (p) => p.trim().toLowerCase() === (userAnswer || "").trim().toLowerCase()
  )
}

// Fisher–Yates シャッフル（元配列は変更しない）
export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// chips 文字列("The|concert|is") → 並べ替え用チップ配列（重複トークン対応でindex付き）
export function toChipTokens(chips) {
  return (chips || "")
    .split("|")
    .filter(Boolean)
    .map((token, i) => ({ id: `c${i}`, token }))
}
