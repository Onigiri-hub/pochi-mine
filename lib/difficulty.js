// 生成英語のスタイル設定。単語の例文生成・長文生成（ja入力）で共通利用する。
// 2軸: ① difficulty（難易度） ② tone（カジュアルさ）。各2段階。
// ★Pochi-next からそのまま流用（変更はこのファイルだけで完結）。

// ① 語彙・文法レベル
export const DIFFICULTY_LEVELS = {
  everyday: { // デフォルト
    label: "日常会話",
    instruction: "日常会話レベルの語彙・文法で。",
    jaTranslationNote: "日常会話でわかる自然な日本語", // en入力→和訳の読みやすさ
  },
  business: {
    label: "ビジネス",
    instruction: "ビジネス・書き言葉レベルの語彙・文法で。",
    jaTranslationNote: "自然な日本語",
  },
}
export const DEFAULT_DIFFICULTY = "everyday"

// ② カジュアルさ
export const TONE_LEVELS = {
  normal: { // デフォルト（初学者おすすめ）
    label: "ノーマル",
    recommended: true,
    instruction: "標準的で自然な、聞き取りやすい英語で。",
  },
  casual: {
    label: "カジュアル",
    recommended: false,
    // ※スラング・省略が入るぶん、理解の難易度は上がる
    instruction: "くだけた表現で。会話文では主語の省略や若者言葉のようなカジュアルな表現を交える。",
  },
}
export const DEFAULT_TONE = "normal"

export function getDifficulty(id) {
  return DIFFICULTY_LEVELS[id] || DIFFICULTY_LEVELS[DEFAULT_DIFFICULTY]
}
export function getTone(id) {
  return TONE_LEVELS[id] || TONE_LEVELS[DEFAULT_TONE]
}

// ja入力→英語生成で使う「英語スタイル指示」（難易度＋トーンを合成）
export function buildEnglishStyle(difficultyId, toneId) {
  return `${getDifficulty(difficultyId).instruction} ${getTone(toneId).instruction}`
}
