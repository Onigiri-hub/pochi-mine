// バックアップ促しポップアップの状態管理（端末ローカル＝localStorage）。
// ★学習データではないので IndexedDB / バックアップJSON には含めない。
//   - 初回: 「定期的にバックアップを取ってね」のお知らせ
//   - 2回目以降: 最終バックアップ（or 最終表示）から1週間以上あいたら再表示
const K_LAST_BACKUP = "pm:backup:lastBackupAt" // 最後にバックアップした時刻(ms)
const K_LAST_PROMPT = "pm:backup:lastPromptAt" // 最後にポップアップを出した時刻(ms)
const K_SEEN = "pm:backup:seen" // 初回お知らせを見たか
const WEEK_MS = 7 * 24 * 3600 * 1000

function ls() {
  try {
    return typeof window !== "undefined" ? window.localStorage : null
  } catch {
    return null // プライベートモード等で例外になる環境の保険
  }
}
function getNum(key) {
  const s = ls()?.getItem(key)
  const n = s ? parseInt(s, 10) : 0
  return Number.isFinite(n) ? n : 0
}
function setNum(key, n) {
  ls()?.setItem(key, String(n))
}

// 書き出し（ファイル保存/コピー）成功時に呼ぶ。次回まで最低1週間あく。
export function markBackupDone() {
  setNum(K_LAST_BACKUP, Date.now())
}

// 初回お知らせをまだ見ていないか
export function isFirstTime() {
  return !ls()?.getItem(K_SEEN)
}

// アプリ起動時にポップアップを出すべきか判定。
// 戻り値: "first"（初回お知らせ）/ "weekly"（1週間バックアップなし）/ null（出さない）
export function shouldRemind(now = Date.now()) {
  if (!ls()) return null
  if (isFirstTime()) return "first"
  const ref = Math.max(getNum(K_LAST_BACKUP), getNum(K_LAST_PROMPT))
  if (!ref) return "weekly" // 見た記録はあるが基準時刻が無い異常系→念のため促す
  return now - ref >= WEEK_MS ? "weekly" : null
}

// ポップアップを表示したら呼ぶ（初回フラグを立て、次回まで1週間あける）。
export function markPromptShown() {
  ls()?.setItem(K_SEEN, "1")
  setNum(K_LAST_PROMPT, Date.now())
}
