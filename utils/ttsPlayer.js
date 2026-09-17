// 文単位の音声再生（Web Speech API・無料）。
// Pochi-mine は音声ファイルを持たないので常に Web Speech で読む。

export function isWebSpeechSupported() {
  return typeof window !== "undefined" && !!window.speechSynthesis
}

// 声リスト(getVoices)は非同期ロードで初回は空になりがち。マウント時に呼んでおく。
export function preloadVoices() {
  if (!isWebSpeechSupported()) return
  try {
    window.speechSynthesis.getVoices()
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices()
    }
  } catch {}
}

// 音声エンジンのウォームアップ。初回発話のコールドスタート対策。
// ※iOS Safari は最初の speak をユーザー操作内で同期実行する必要がある。
let _warmed = false
export function warmUpSpeech() {
  if (_warmed || !isWebSpeechSupported()) return
  try {
    window.speechSynthesis.getVoices()
    const u = new SpeechSynthesisUtterance(" ")
    u.volume = 0
    window.speechSynthesis.speak(u)
    _warmed = true
  } catch {}
}

// 英文を1つ読む。
export function playWebSpeech(text) {
  if (!isWebSpeechSupported() || !text) return
  window.speechSynthesis.cancel() // 多重再生防止
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = "en-US"
  utter.rate = 0.95
  const voices = window.speechSynthesis.getVoices()
  const en = voices.find((v) => v.lang.startsWith("en"))
  if (en) utter.voice = en
  window.speechSynthesis.speak(utter)
}

// 複数文を順番に読み上げ（全文リスニング用）。戻り値: 停止関数。
export function playAllWebSpeech(texts, { onIndex, onDone } = {}) {
  if (!isWebSpeechSupported()) {
    onDone && onDone()
    return () => {}
  }
  let cancelled = false
  let idx = 0
  window.speechSynthesis.cancel()
  const voices = window.speechSynthesis.getVoices()
  const en = voices.find((v) => v.lang.startsWith("en"))
  const playNext = () => {
    if (cancelled) return
    if (idx >= texts.length) {
      onDone && onDone()
      return
    }
    onIndex && onIndex(idx)
    const u = new SpeechSynthesisUtterance(texts[idx])
    u.lang = "en-US"
    u.rate = 0.95
    if (en) u.voice = en
    u.onend = () => {
      idx++
      setTimeout(playNext, 250)
    }
    u.onerror = () => {
      idx++
      setTimeout(playNext, 250)
    }
    window.speechSynthesis.speak(u)
  }
  playNext()
  return () => {
    cancelled = true
    window.speechSynthesis.cancel()
  }
}
