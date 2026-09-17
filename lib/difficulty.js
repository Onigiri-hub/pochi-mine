// 生成英語のレベル設定。2モードから選ぶ:
//   ① CEFR（A1〜C2）  ② 文法レベル（1〜6・積み上げ式）
// 設定画面で一元管理し、単語例文生成 / ja入力のStory生成 / TALK の英語レベルに反映する。
// カジュアルさ（トーン）は設定では持たず、各機能で文脈に寄せる（プロンプト側で指示）。
// en入力Storyの和訳は「英文の雰囲気を反映した自然な日本語」で、レベル指定はしない。

// ---- CEFR（表示ラベル＝ユーザー向け概要 / ai＝プロンプトに渡す語彙・文法の目安）----
export const CEFR_LEVELS = {
  A1: { label: "単語・定型表現で意思疎通", ai: "現在形を中心に、ごく基礎的な語彙と定型表現だけで。短くシンプルな文にする。" },
  A2: { label: "身近なことなら会話できる", ai: "現在形・過去形を中心に、身近な話題の基本的な語彙で。" },
  B1: { label: "旅行・仕事などを自力でこなせる", ai: "現在・過去・未来・現在完了、比較、基本的な関係詞まで。日常や一般的な話題の語彙で。" },
  B2: { label: "抽象的な話題も議論できる", ai: "受動態・関係詞・仮定法の基本を含め、抽象的な話題も扱える幅広い語彙で。" },
  C1: { label: "専門的・複雑な内容も柔軟に扱える", ai: "分詞構文・仮定法・倒置など複雑な構文や慣用表現、専門的な語彙も自然に交えて。" },
  C2: { label: "高度なニュアンスまで自在に理解・表現できる", ai: "ネイティブ相当。あらゆる構文・慣用表現・微妙なニュアンスを自在に使う。" },
}
export const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]

// ---- 文法レベル（表示ラベル＝使える文法の一覧 / 積み上げ式＝レベルNはレベル1〜Nを含む）----
export const GRAMMAR_LEVELS = {
  1: { label: "文の基本、現在形、過去形、助動詞、ing形、to不定詞、疑問詞等が使えるレベル" },
  2: { label: "未来形、比較級、最上級、受動態等が使えるレベル" },
  3: { label: "現在完了、原形不定詞、what to、how to等が使えるレベル" },
  4: { label: "仮定法、関係詞、感嘆文等が使えるレベル" },
  5: { label: "過去完了、未来完了、分詞構文、仮定法過去完了等が使えるレベル" },
  6: { label: "複雑な文法でも使えるレベル" },
}
export const GRAMMAR_ORDER = [1, 2, 3, 4, 5, 6]

// 既定：どちらのモードも一番下のレベル。既定モードは CEFR。
export const DEFAULT_LEVEL_MODE = "cefr"
export const DEFAULT_CEFR = "A1"
export const DEFAULT_GRAMMAR = 1

function clampCefr(code) {
  return CEFR_LEVELS[code] ? code : DEFAULT_CEFR
}
function clampGrammar(n) {
  const v = parseInt(n, 10)
  return GRAMMAR_LEVELS[v] ? v : DEFAULT_GRAMMAR
}

// 設定オブジェクトから、API に渡すレベル情報だけを取り出す。
export function pickLevel(s) {
  return {
    levelMode: s?.levelMode === "grammar" ? "grammar" : "cefr",
    cefrLevel: clampCefr(s?.cefrLevel),
    grammarLevel: clampGrammar(s?.grammarLevel),
  }
}

// レベル情報 → プロンプトに差し込む「英語レベル指示」を組み立てる。
export function buildLevelInstruction(level) {
  const mode = level?.levelMode === "grammar" ? "grammar" : "cefr"
  if (mode === "grammar") {
    const n = clampGrammar(level?.grammarLevel)
    const range = GRAMMAR_ORDER.slice(0, n).map((k) => GRAMMAR_LEVELS[k].label).join(" / ")
    return `英語の文法レベルは「レベル${n}」相当。使ってよい文法の目安は次の範囲です（レベル1〜${n}）: ${range}。この範囲の文法を中心に、自然でわかりやすい英語にしてください。ただし、より自然な英語にするために必要なら、この範囲を多少超えても構いません。`
  }
  const code = clampCefr(level?.cefrLevel)
  const c = CEFR_LEVELS[code]
  return `英語のレベルはCEFR ${code}相当（${c.label}）。${c.ai}`
}
