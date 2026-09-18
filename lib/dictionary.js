// ローカル辞書（public/data/word_dic.csv）でのオフライン単語照合。
// 長押しの意味ポップアップで「辞書にあれば辞書・無ければAPI」を実現するため、
// クライアント側で一度だけCSVを読み込み、word＋variants を Map 化して引く。
// 辞書ヒット時は API を叩かない（コストゼロ・即時）。Pochi本家の word_dic.csv と同形式。

let mapPromise = null // Map<normalizedKey, ja> を返すPromise（モジュール内で一度だけ構築）

// クォート対応の最小CSV行パーサ（"..." 内のカンマ／二重引用符エスケープに対応）。
function splitCsvLine(line) {
  const out = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else { inQuotes = false }
      } else cur += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ",") { out.push(cur); cur = "" }
      else cur += ch
    }
  }
  out.push(cur)
  return out
}

// 前後の非単語文字を除去して小文字化（本家 useDictionary.normalize と同挙動）。
// アポストロフィは語中に残す（don't, it's, o'clock）。全角 ‘ ’ は半角 ' に正規化。
function normalize(word) {
  return String(word || "")
    .replace(/[‘’]/g, "'")
    .replace(/^[^\w']+|[^\w']+$/g, "")
    .toLowerCase()
}

// variants（"|"区切り）を配列化。NaN/空は無視。
function splitVariants(v) {
  if (!v || typeof v !== "string") return []
  const s = v.trim()
  if (!s || s.toLowerCase() === "nan") return []
  return s.split("|").map((x) => x.trim()).filter(Boolean)
}

async function getMap() {
  if (!mapPromise) {
    mapPromise = (async () => {
      const res = await fetch("/data/word_dic.csv")
      if (!res.ok) throw new Error("dictionary fetch failed")
      const text = await res.text()
      const lines = text.split(/\r?\n/)
      const header = splitCsvLine(lines[0])
      const iWord = header.indexOf("word")
      const iVar = header.indexOf("variants")
      const iJa = header.indexOf("ja")
      const m = new Map()
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) continue
        const cols = splitCsvLine(lines[i])
        const ja = (cols[iJa] || "").trim()
        if (!ja) continue
        const keys = [cols[iWord], ...splitVariants(cols[iVar])]
        for (const k of keys) {
          const nk = normalize(k)
          if (nk && !m.has(nk)) m.set(nk, ja) // 先勝ち（本家と同じ）
        }
      }
      return m
    })().catch((err) => {
      mapPromise = null // 失敗時は次回リトライできるようにキャッシュを捨てる
      throw err
    })
  }
  return mapPromise
}

// 単語の日本語訳を辞書から引く。ヒットで文字列、無ければ null（＝API側へフォールバック）。
export async function lookupDictionary(word) {
  try {
    const m = await getMap()
    return m.get(normalize(word)) || null
  } catch {
    return null
  }
}
