// 設定画面。API設定（プロバイダー/キー/接続テスト/各上限）と 生成英文設定（例文数/レベル）に整理。
// 変更は入力した時点でIndexedDBへ自動保存（保存ボタンなし）。最下部に移行・バックアップ導線。
import { useEffect, useState } from "react"
import { useRouter } from "next/router"
import Navigation from "../components/Navigation"
import { getSettings, saveSettings, getMonthUsage } from "../lib/store"
import { generateWord } from "../lib/api"
import { COLORS, segBtn } from "../lib/ui"
import { CEFR_LEVELS, CEFR_ORDER, GRAMMAR_LEVELS, GRAMMAR_ORDER, pickLevel } from "../lib/difficulty"

const PROVIDERS = [
  { id: "gemini", label: "Gemini", hint: "Google AI Studio（無料枠大・試しやすい）" },
  { id: "openai", label: "OpenAI", hint: "platform.openai.com（sk-…）" },
  { id: "claude", label: "Claude", hint: "console.anthropic.com（sk-ant-…）" },
]

const LABEL = { fontSize: "13px", fontWeight: "bold", color: COLORS.sub, marginBottom: "6px" }
const INPUT = { width: "100%", padding: "12px", borderRadius: "10px", border: `1px solid ${COLORS.line}`, fontSize: "15px", boxSizing: "border-box" }

function levelRow(active) {
  return {
    display: "flex", flexDirection: "column", gap: "2px", alignItems: "flex-start", textAlign: "left",
    width: "100%", padding: "10px 12px", borderRadius: "10px", cursor: "pointer",
    border: active ? "2px solid " + COLORS.primary : "1px solid " + COLORS.line,
    background: active ? COLORS.primarySoft : "#fff",
  }
}
const levelCode = { fontSize: "14px", fontWeight: "bold", color: COLORS.text }
const levelDesc = { fontSize: "12px", color: COLORS.sub, lineHeight: 1.5 }

// クリックで開閉するカテゴリ見出し（タイトル中央・下線は section_underbar.png）
function Section({ title, note, open, onToggle }) {
  return (
    <div style={{ marginTop: "34px" }}>
      <div onClick={onToggle} style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", paddingBottom: "4px", cursor: "pointer", userSelect: "none" }}>
        <span style={{ fontSize: "16px", fontWeight: "bold", color: COLORS.text }}>{title}</span>
        {note && <span style={{ fontSize: "12px", color: COLORS.muted }}>（{note}）</span>}
        <span style={{ position: "absolute", right: 0, color: COLORS.sub, fontSize: "13px" }}>{open ? "▲" : "▼"}</span>
      </div>
      <img src="/images/illustrations/section_underbar.png" alt="" style={{ display: "block", width: "100%", height: "auto", margin: "2px 0 0", pointerEvents: "none" }} />
    </div>
  )
}

// 上限入力（数値＋プリセット＋なし）。※フォーカス喪失を防ぐためコンポーネント外に定義。
function LimitInput({ value, onChange, presets }) {
  return (
    <>
      <input type="number" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0（未設定）" style={INPUT} />
      <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
        {presets.map((n) => (
          <button key={n} onClick={() => onChange(n)} style={{ ...segBtn(Number(value) === n), padding: "6px 0", fontSize: "12px" }}>
            {n.toLocaleString("en-US")}
          </button>
        ))}
        <button onClick={() => onChange(0)} style={{ ...segBtn(Number(value) === 0), padding: "6px 0", fontSize: "12px" }}>なし</button>
      </div>
    </>
  )
}

export default function Settings() {
  const router = useRouter()
  const [provider, setProvider] = useState("gemini")
  const [apiKey, setApiKey] = useState("")
  const [defaultCount, setDefaultCount] = useState(3)
  const [levelMode, setLevelMode] = useState("cefr")
  const [cefrLevel, setCefrLevel] = useState("A1")
  const [grammarLevel, setGrammarLevel] = useState(1)
  const [dailyTokenLimit, setDailyTokenLimit] = useState(0)
  const [dailyRequestLimit, setDailyRequestLimit] = useState(0)
  const [monthlyTokenLimit, setMonthlyTokenLimit] = useState(0)
  const [monthUsed, setMonthUsed] = useState(null)
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null) // { ok, message }
  const [open, setOpen] = useState({ api: false, words: false, gen: false }) // カテゴリ開閉（初期は全部閉じる）
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }))

  useEffect(() => {
    getSettings().then((s) => {
      if (s.provider) setProvider(s.provider)
      setApiKey(s.apiKey || "")
      setDefaultCount(s.defaultCount || 3)
      setLevelMode(s.levelMode || "cefr")
      setCefrLevel(s.cefrLevel || "A1")
      setGrammarLevel(s.grammarLevel || 1)
      setDailyTokenLimit(s.dailyTokenLimit || 0)
      setDailyRequestLimit(s.dailyRequestLimit || 0)
      setMonthlyTokenLimit(s.monthlyTokenLimit || 0)
    })
    getMonthUsage().then((m) => setMonthUsed(m.total))
  }, [])

  // 現在のstateを丸ごと保存（変更ぶんは patch で上書き）。入力のたびに呼ぶ＝自動保存。
  function persist(patch) {
    return saveSettings({
      provider,
      apiKey: apiKey.trim(),
      defaultCount,
      levelMode,
      cefrLevel,
      grammarLevel,
      dailyTokenLimit: Number(dailyTokenLimit) || 0,
      dailyRequestLimit: Number(dailyRequestLimit) || 0,
      monthlyTokenLimit: Number(monthlyTokenLimit) || 0,
      ...patch,
    })
  }
  const pickProvider = (id) => { setProvider(id); persist({ provider: id }) }
  const changeKey = (v) => { setApiKey(v); persist({ apiKey: v.trim() }) }
  const pickCount = (n) => { setDefaultCount(n); persist({ defaultCount: n }) }
  const pickMode = (m) => { setLevelMode(m); persist({ levelMode: m }) }
  const pickCefr = (v) => { setCefrLevel(v); persist({ cefrLevel: v }) }
  const pickGrammar = (n) => { setGrammarLevel(n); persist({ grammarLevel: n }) }
  const changeDailyToken = (v) => { setDailyTokenLimit(v); persist({ dailyTokenLimit: Number(v) || 0 }) }
  const changeDailyReq = (v) => { setDailyRequestLimit(v); persist({ dailyRequestLimit: Number(v) || 0 }) }
  const changeMonthly = (v) => { setMonthlyTokenLimit(v); persist({ monthlyTokenLimit: Number(v) || 0 }) }

  async function testConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      const data = await generateWord({ provider, apiKey: apiKey.trim(), word: "test", count: 1, level: pickLevel({ levelMode, cefrLevel, grammarLevel }) })
      const ok = Array.isArray(data?.sentences) && data.sentences.length > 0
      setTestResult({ ok, message: ok ? `疎通OK（例: ${data.sentences[0].en}）` : "応答は来ましたが例文が空でした" })
    } catch (e) {
      setTestResult({ ok: false, message: e?.message || "接続に失敗しました" })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, paddingBottom: "90px" }}>
      <div style={{ textAlign: "center", padding: "22px 0 6px", fontSize: "20px", fontWeight: "bold", color: COLORS.text }}>
        設定
      </div>
      <div style={{ textAlign: "center", fontSize: "12px", color: COLORS.muted, marginBottom: "16px" }}>
        変更はその場で自動保存されます
      </div>

      <div style={{ maxWidth: "440px", margin: "0 auto", padding: "0 20px", display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* ==================== API設定 ==================== */}
        <Section title="API設定" open={open.api} onToggle={() => toggle("api")} />
        {open.api && (
          <>
            {/* プロバイダー */}
            <div>
              <div style={LABEL}>AIプロバイダー</div>
              <div style={{ display: "flex", gap: "8px" }}>
                {PROVIDERS.map((p) => (
                  <button key={p.id} onClick={() => pickProvider(p.id)} style={segBtn(provider === p.id)}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: "12px", color: COLORS.muted, marginTop: "6px" }}>
                {PROVIDERS.find((p) => p.id === provider)?.hint}
              </div>
            </div>

            {/* APIキー */}
            <div>
              <div style={LABEL}>APIキー</div>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => changeKey(e.target.value)}
                  placeholder="ここに自分のAPIキー"
                  style={{ flex: 1, padding: "12px", borderRadius: "10px", border: `1px solid ${COLORS.line}`, fontSize: "14px" }}
                />
                <button onClick={() => setShowKey((v) => !v)} style={{ ...segBtn(false), flex: "none", width: "64px" }}>
                  {showKey ? "隠す" : "表示"}
                </button>
              </div>
              <div style={{ fontSize: "12px", color: COLORS.muted, marginTop: "6px" }}>
                キーはこの端末（IndexedDB）にだけ保存されます。生成時にサーバーを一瞬通りますが、保存もログもされません。
              </div>
            </div>

            {/* 接続テスト（色付き） */}
            <div>
              <button
                onClick={testConnection}
                disabled={testing || !apiKey.trim()}
                style={{ width: "100%", padding: "13px", borderRadius: "10px", border: "none", fontSize: "14px", fontWeight: "bold", color: "#fff", background: testing || !apiKey.trim() ? "#ccc" : COLORS.primary, cursor: testing || !apiKey.trim() ? "default" : "pointer" }}
              >
                {testing ? "テスト中…" : "接続テスト（キーが有効か確認）"}
              </button>
              {testResult && (
                <div style={{ marginTop: "10px", fontSize: "13px", color: testResult.ok ? COLORS.ok : COLORS.danger, lineHeight: 1.6 }}>
                  {testResult.ok ? "✓ " : "✗ "}{testResult.message}
                </div>
              )}
            </div>

            {/* 1か月のトークン上限（目安） */}
            <div>
              <div style={LABEL}>1か月のトークン上限（目安）</div>
              <div style={{ fontSize: "13px", fontWeight: "bold", color: monthlyTokenLimit > 0 && monthUsed != null && monthUsed >= monthlyTokenLimit ? COLORS.danger : COLORS.sub, marginBottom: "8px" }}>
                今月の使用量：{monthUsed == null ? "…" : monthUsed.toLocaleString("en-US")}{monthlyTokenLimit > 0 ? ` / ${Number(monthlyTokenLimit).toLocaleString("en-US")}` : ""} tok
              </div>
              <LimitInput value={monthlyTokenLimit} onChange={changeMonthly} presets={[100000, 500000, 1000000]} />
              <div style={{ fontSize: "12px", color: COLORS.muted, marginTop: "6px" }}>
                右上には表示しません。ここで今月の合計を確認できます（JST月初にリセット）。
              </div>
            </div>

            {/* 1日のトークン上限（目安） */}
            <div>
              <div style={LABEL}>1日のトークン上限（目安）</div>
              <LimitInput value={dailyTokenLimit} onChange={changeDailyToken} presets={[10000, 50000, 100000]} />
              <div style={{ fontSize: "12px", color: COLORS.muted, marginTop: "6px" }}>
                右上に「今日の使用量 / 上限」を常時表示します。上限は目安で、超えても止まりません（JST0時にリセット）。
              </div>
            </div>

            {/* 1日のリクエスト回数上限（目安） */}
            <div>
              <div style={LABEL}>1日のリクエスト回数上限（目安）</div>
              <LimitInput value={dailyRequestLimit} onChange={changeDailyReq} presets={[500, 1000, 1500]} />
              <div style={{ fontSize: "12px", color: COLORS.muted, marginTop: "6px" }}>
                AIを呼ぶ操作1回で+1。無料枠の実上限は回数のことが多い（例: Gemini無料枠 1日1,500回）。
              </div>
            </div>
          </>
        )}

        {/* ==================== 並べて英単語設定 ==================== */}
        <Section title="並べて英単語設定" open={open.words} onToggle={() => toggle("words")} />
        {open.words && (
          <div>
            <div style={LABEL}>単語1つあたりの既定の例文数</div>
            <div style={{ display: "flex", gap: "8px" }}>
              {[1, 2, 3, 4].map((n) => (
                <button key={n} onClick={() => pickCount(n)} style={segBtn(defaultCount === n)}>
                  {n}
                </button>
              ))}
            </div>
            <div style={{ fontSize: "12px", color: COLORS.muted, marginTop: "6px" }}>
              「並べて英単語」で1単語につき生成する例文の数です。
            </div>
          </div>
        )}

        {/* ==================== 生成英文設定 ==================== */}
        <Section title="生成英文設定" note="全機能に反映" open={open.gen} onToggle={() => toggle("gen")} />
        {open.gen && (
          <div>
            <div style={LABEL}>生成する英語のレベル</div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <button onClick={() => pickMode("cefr")} style={segBtn(levelMode === "cefr")}>CEFRで選ぶ</button>
              <button onClick={() => pickMode("grammar")} style={segBtn(levelMode === "grammar")}>文法で選ぶ</button>
            </div>
            {levelMode === "cefr" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {CEFR_ORDER.map((code) => (
                  <button key={code} onClick={() => pickCefr(code)} style={levelRow(cefrLevel === code)}>
                    <span style={levelCode}>{code}</span>
                    <span style={levelDesc}>{CEFR_LEVELS[code].label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {GRAMMAR_ORDER.map((n) => (
                  <button key={n} onClick={() => pickGrammar(n)} style={levelRow(grammarLevel === n)}>
                    <span style={levelCode}>レベル{n}</span>
                    <span style={levelDesc}>{GRAMMAR_LEVELS[n].label}</span>
                  </button>
                ))}
              </div>
            )}
            <div style={{ fontSize: "12px", color: COLORS.muted, marginTop: "8px" }}>
              並べて英単語・My長文・TALKなど、AIが英語を作るとき全体に反映されます。
            </div>
          </div>
        )}

        {/* データの移行・バックアップ（一番下） */}
        <button
          onClick={() => router.push("/backup")}
          style={{ ...segBtn(false), width: "100%", padding: "14px", marginTop: "8px" }}
        >
          📦 データの移行・バックアップ
        </button>

        {/* 規約とポリシー */}
        <div style={{ textAlign: "center", marginTop: "18px", marginBottom: "4px" }}>
          <button
            onClick={() => router.push("/terms")}
            style={{ background: "none", border: "none", color: COLORS.muted, fontSize: "13px", textDecoration: "underline", cursor: "pointer" }}
          >
            規約とポリシー
          </button>
        </div>
      </div>

      <Navigation />
    </div>
  )
}
