// 並べて英単語（Pochi本家 arrangeSectionList に寄せたレイアウト）。
// ヘッダー / 出題2ボタン / ツールバー(並べ替え・優先順位・単語登録) / 開閉式登録フォーム / 単語リスト。
// リストの●は「やった(done)」「自信度(confidence)」= 本家式。生成済み/未生成は単語の下に表示。
// ※生成は1単語ずつ（未生成行の「生成」ボタン＝genOne）。一括生成はあえて設けない
//   ＝1回=1リクエスト＝トークンを使っている、という意識づけのため（確定・2026-09-17）。
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/router"
import Navigation from "../components/Navigation"
import {
  listWords,
  addWord,
  deleteWord,
  updateWord,
  getSettings,
  getApiConfig,
  saveGeneratedSentences,
} from "../lib/store"
import { generateWord } from "../lib/api"
import { COLORS } from "../lib/ui"

// 自信度 → 色（本家踏襲）
const CONFIDENCE_COLORS = { none: "#ccc", low: "#e53935", high: "#02ccbb" }
const LEARNED_COLOR = "#ffa726" // やった
const UNLEARNED_COLOR = "#ccc" // まだ

// done×confidence の6バケツ（本家踏襲）
const BUCKETS = {
  off_none: { done: false, conf: "none", label: "まだ・自信未入力" },
  off_low: { done: false, conf: "low", label: "まだ・自信ない" },
  on_none: { done: true, conf: "none", label: "やった・自信未入力" },
  on_low: { done: true, conf: "low", label: "やった・自信ない" },
  off_high: { done: false, conf: "high", label: "まだ・自信あり" },
  on_high: { done: true, conf: "high", label: "やった・自信あり" },
}
const DEFAULT_ORDER = ["off_none", "off_low", "on_none", "on_low", "off_high", "on_high"]
const SORT_ORDER_KEY = "pm_arrangeSortOrder"
const WORDS_PER_SESSION = 5
const ROW_H = 60

// word.confidence（"none"/"low"/"high" or 旧数値）→ 正規化
function confOf(w) {
  const c = w?.confidence
  if (c === "low" || c === "high" || c === "none") return c
  if (typeof c === "number") return c >= 2 ? "high" : c === 1 ? "low" : "none"
  return "none"
}
function bucketKey(w) {
  return `${w?.done ? "on" : "off"}_${confOf(w)}`
}
function getStoredOrder() {
  try {
    const raw = localStorage.getItem(SORT_ORDER_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr) && arr.length === DEFAULT_ORDER.length && DEFAULT_ORDER.every((k) => arr.includes(k))) return arr
    }
  } catch {}
  return DEFAULT_ORDER
}
function sortByPriority(list, order) {
  const rankOf = (w) => {
    const r = order.indexOf(bucketKey(w))
    return r === -1 ? order.length : r
  }
  return list.map((w, i) => ({ w, i, rank: rankOf(w) })).sort((a, b) => a.rank - b.rank || a.i - b.i).map((x) => x.w)
}
function sortAlphabetically(list) {
  return [...list].sort((a, b) => (a.word || "").localeCompare(b.word || "", "en", { sensitivity: "base" }))
}
function sortByCreated(list) {
  return [...list].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
}

const toolBtnStyle = {
  padding: "6px 12px",
  borderRadius: "8px",
  border: "1px solid #ddd",
  background: "white",
  color: "#555",
  fontSize: "13px",
  fontWeight: "bold",
  cursor: "pointer",
}
function confBtnStyle(color) {
  return { padding: "12px 0", borderRadius: "10px", border: "none", background: color, color: "white", fontSize: "15px", fontWeight: "bold", cursor: "pointer", transition: "background 0.15s" }
}

export default function Words() {
  const router = useRouter()
  const [words, setWords] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  // 登録フォーム（開閉式）
  const [showAdd, setShowAdd] = useState(false)
  const [input, setInput] = useState("")

  // 編集/生成
  const [editing, setEditing] = useState(null) // {id,value}
  const [confirmDelete, setConfirmDelete] = useState(null) // 削除確認中 {id,word}
  const [genningId, setGenningId] = useState(null)

  // 出題・並べ替え
  const [popupWord, setPopupWord] = useState(null)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [sortFlash, setSortFlash] = useState(null) // タップされた並べ替えボタン（一瞬オレンジに）
  const [showSelectModal, setShowSelectModal] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [selectToast, setSelectToast] = useState(null)

  // 優先順位ドラッグ
  const [showSortSettings, setShowSortSettings] = useState(false)
  const [order, setOrderState] = useState(DEFAULT_ORDER)
  const orderRef = useRef(DEFAULT_ORDER)
  const setOrder = (next) => {
    const v = typeof next === "function" ? next(orderRef.current) : next
    orderRef.current = v
    setOrderState(v)
  }
  const [dragIndex, setDragIndexState] = useState(null)
  const dragIndexRef = useRef(null)
  const setDragIndex = (v) => {
    dragIndexRef.current = v
    setDragIndexState(v)
  }
  const [dragOffset, setDragOffset] = useState(0)
  const pointerStartY = useRef(0)

  async function reload(ord) {
    const o = ord || orderRef.current
    const list = await listWords()
    setWords(sortByPriority(list, o))
  }

  useEffect(() => {
    const o = getStoredOrder()
    setOrder(o)
    getSettings().then(setSettings)
    reload(o).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- 登録 ---
  async function add() {
    const w = input.trim()
    if (!w) return
    await addWord({ word: w, requestedCount: settings?.defaultCount || 3 })
    setInput("")
    reload()
  }

  async function saveEdit() {
    const v = (editing?.value || "").trim()
    if (!v) return
    await updateWord(editing.id, { word: v })
    setEditing(null)
    reload()
  }

  async function doDeleteWord() {
    if (!confirmDelete) return
    await deleteWord(confirmDelete.id)
    setConfirmDelete(null)
    reload()
  }

  // --- 単語1つを生成（1単語=1リクエスト。一括生成はあえて設けない）---
  async function genOne(w) {
    const cfg = await getApiConfig()
    if (!cfg.provider || !cfg.apiKey) {
      if (confirm("APIキーが未設定です。設定画面へ移動しますか？")) router.push("/settings")
      return
    }
    const s = settings || (await getSettings())
    setGenningId(w.id)
    try {
      const data = await generateWord({ provider: cfg.provider, apiKey: cfg.apiKey, model: cfg.model, word: w.word, count: s.defaultCount || 3, difficulty: s.difficulty })
      await saveGeneratedSentences(w.id, data.sentences)
      const fixed = (data.corrected || "").trim()
      if (fixed && fixed.toLowerCase() !== w.word.trim().toLowerCase()) await updateWord(w.id, { word: fixed })
      await reload()
    } catch (e) {
      alert(e?.message || "生成に失敗しました")
    } finally {
      setGenningId(null)
    }
  }

  // --- 自信度 ---
  async function setConfidence(wordId, conf) {
    await updateWord(wordId, { confidence: conf })
    setPopupWord(null)
    reload()
  }

  // --- 並べ替え（タップ→オレンジで押した感→0.5秒後に閉じる）---
  function applySort(key) {
    if (key === "created") setWords(sortByCreated(words))
    else if (key === "alpha") setWords(sortAlphabetically(words))
    else if (key === "priority") setWords(sortByPriority(words, orderRef.current))
    setSortFlash(key)
    setTimeout(() => {
      setShowSortMenu(false)
      setSortFlash(null)
    }, 500)
  }

  // --- 出題 ---
  function toast(msg) {
    setSelectToast(msg)
    setTimeout(() => setSelectToast(null), 2000)
  }
  function startOrdered() {
    const pool = words.filter((w) => w.generated && confOf(w) !== "high")
    const picked = pool.slice(0, WORDS_PER_SESSION)
    if (picked.length === 0) {
      toast("生成済みの単語がありません")
      return
    }
    router.push(`/practice?wordIds=${picked.map((w) => w.id).join(",")}`)
  }
  function openSelectModal() {
    setSelectedIds([])
    setShowSelectModal(true)
  }
  function toggleSelect(id) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= WORDS_PER_SESSION) {
        toast(`${WORDS_PER_SESSION}個まで選べます`)
        return prev
      }
      return [...prev, id]
    })
  }
  function startSelected() {
    if (selectedIds.length === 0) return
    const ids = words.filter((w) => selectedIds.includes(w.id)).map((w) => w.id).join(",")
    router.push(`/practice?wordIds=${ids}`)
  }

  // --- 優先順位ドラッグ ---
  function startDrag(e, i) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointerStartY.current = e.clientY
    setDragIndex(i)
    setDragOffset(0)
  }
  function onDragMove(e) {
    const di = dragIndexRef.current
    if (di === null) return
    const offset = e.clientY - pointerStartY.current
    const target = Math.max(0, Math.min(orderRef.current.length - 1, di + Math.round(offset / ROW_H)))
    if (target !== di) {
      const next = [...orderRef.current]
      const [moved] = next.splice(di, 1)
      next.splice(target, 0, moved)
      setOrder(next)
      pointerStartY.current += (target - di) * ROW_H
      setDragIndex(target)
      setDragOffset(e.clientY - pointerStartY.current)
    } else {
      setDragOffset(offset)
    }
  }
  function endDrag() {
    setDragIndex(null)
    setDragOffset(0)
  }
  function closeSortSettings() {
    try {
      localStorage.setItem(SORT_ORDER_KEY, JSON.stringify(orderRef.current))
    } catch {}
    setShowSortSettings(false)
    setWords(sortByPriority(words, orderRef.current))
  }

  if (loading) return <Center>読み込み中…</Center>

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, paddingBottom: "90px" }}>
      <div style={{ maxWidth: "440px", margin: "0 auto", padding: "12px 16px 0", display: "flex", flexDirection: "column" }}>
        {/* ヘッダー */}
        <div style={{ position: "relative", margin: "12px 0 26px" }}>
          <button onClick={() => router.push("/")} style={{ position: "absolute", left: 0, top: 0, background: "none", border: "none", fontSize: "15px", fontWeight: "bold", color: COLORS.text, cursor: "pointer", padding: "4px 8px" }}>◀</button>
          <div style={{ textAlign: "center", paddingTop: "2px" }}>
            <div style={{ fontWeight: "bold", fontSize: "18px", color: COLORS.text }}>並べて英単語</div>
            <img src="/images/illustrations/section_underbar.png" alt="" style={{ display: "block", width: "100%", height: "auto", margin: "2px auto 0", pointerEvents: "none" }} />
          </div>
        </div>

        {/* 出題モードボタン */}
        <div style={{ display: "flex", gap: "12px", margin: "18px 0" }}>
          <button onClick={startOrdered} style={{ flex: 1, padding: "14px 0", borderRadius: "100px", border: "none", background: COLORS.text, color: "white", fontSize: "15px", fontWeight: "bold", cursor: "pointer" }}>上から順番にやる！</button>
          <button onClick={openSelectModal} style={{ flex: 1, padding: "14px 0", borderRadius: "100px", border: "none", background: COLORS.text, color: "white", fontSize: "15px", fontWeight: "bold", cursor: "pointer" }}>自分で選んで出題</button>
        </div>

        {/* ツールバー（左:単語登録 / 右:並べ替え・優先順位） */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", marginBottom: "8px" }}>
          <button onClick={() => setShowAdd((v) => !v)} style={{ ...toolBtnStyle, background: showAdd ? COLORS.primarySoft : "white", borderColor: showAdd ? COLORS.primary : "#ddd" }}>
            {showAdd ? "× 閉じる" : "＋ 単語登録"}
          </button>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => setShowSortMenu(true)} style={toolBtnStyle}><img src="/images/icons/swap_333.svg" alt="" style={{ width: "14px", height: "14px", verticalAlign: "-2px", marginRight: "4px" }} />並べ替え</button>
            <button onClick={() => setShowSortSettings(true)} style={toolBtnStyle}><img src="/images/icons/settings_333.svg" alt="" style={{ width: "14px", height: "14px", verticalAlign: "-2px", marginRight: "4px" }} />優先順位</button>
          </div>
        </div>

        {/* 開閉式：単語登録フォーム */}
        {showAdd && (
          <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: "12px", padding: "12px", marginBottom: "10px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
                placeholder="単語を入力（例: appreciate）"
                autoFocus
                style={{ flex: 1, padding: "11px", borderRadius: "10px", border: `1px solid ${COLORS.line}`, fontSize: "15px" }}
              />
              <button onClick={add} disabled={!input.trim()} style={{ padding: "0 18px", borderRadius: "10px", border: "none", background: input.trim() ? COLORS.text : "#ccc", color: "#fff", fontWeight: "bold", cursor: input.trim() ? "pointer" : "default" }}>追加</button>
            </div>
            <div style={{ fontSize: "11px", color: COLORS.muted, marginTop: "8px" }}>登録後、未生成の単語は「生成」で例文を作れます。</div>
          </div>
        )}

        {/* 単語リスト */}
        <div style={{ border: "1px solid #eee", borderRadius: "12px", padding: "4px 0", background: "#fafafa" }}>
          {words.length === 0 ? (
            <div style={{ textAlign: "center", color: COLORS.muted, fontSize: "14px", padding: "30px 16px" }}>
              まだ単語がありません。「＋ 単語登録」から追加してね。
            </div>
          ) : (
            words.map((w, i) => {
              const learnedColor = w.done ? LEARNED_COLOR : UNLEARNED_COLOR
              const confidenceColor = CONFIDENCE_COLORS[confOf(w)]
              return (
                <div key={w.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderBottom: i < words.length - 1 ? "1px solid #eee" : "none" }}>
                  {/* 単語＋状態 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "15px", fontWeight: "bold", color: COLORS.text }}>{w.word}</div>
                    <div style={{ fontSize: "11px", color: COLORS.muted, marginTop: "2px" }}>
                      {genningId === w.id ? "生成中…" : w.generated ? <span style={{ color: COLORS.ok }}>● 生成済み</span> : <span>○ 未生成</span>}
                    </div>
                  </div>

                  {/* 未生成なら生成ボタン（1単語ずつ） */}
                  {!w.generated && genningId !== w.id && (
                    <button onClick={() => genOne(w)} style={{ ...toolBtnStyle, padding: "5px 10px", fontSize: "12px" }}>生成</button>
                  )}

                  {/* ●やった（表示） */}
                  <span title="やったか" style={{ width: "14px", height: "14px", borderRadius: "50%", background: learnedColor, display: "inline-block", flex: "none" }} />
                  {/* ●自信度（タップ） */}
                  <span title="自信度" onClick={() => setPopupWord(w)} style={{ width: "14px", height: "14px", borderRadius: "50%", background: confidenceColor, display: "inline-block", cursor: "pointer", flex: "none" }} />

                  {/* 編集・削除 */}
                  <button onClick={() => setEditing({ id: w.id, value: w.word })} style={{ background: "none", border: "none", cursor: "pointer", flex: "none", padding: "2px" }} aria-label="編集"><img src="/images/icons/edit_888.svg" alt="編集" style={{ width: "16px", height: "16px", display: "block" }} /></button>
                  <button onClick={() => setConfirmDelete({ id: w.id, word: w.word })} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: "17px", cursor: "pointer", flex: "none" }} aria-label="削除">×</button>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 並べ替えメニュー */}
      {showSortMenu && (
        <Overlay onClose={() => setShowSortMenu(false)}>
          <div style={{ fontWeight: "bold", fontSize: "17px", marginBottom: "16px", textAlign: "center" }}>並べ替え</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button onClick={() => applySort("created")} style={confBtnStyle(sortFlash === "created" ? COLORS.primary : COLORS.text)}>登録日順（古い順）</button>
            <button onClick={() => applySort("alpha")} style={confBtnStyle(sortFlash === "alpha" ? COLORS.primary : COLORS.text)}>アルファベット順</button>
            <button onClick={() => applySort("priority")} style={confBtnStyle(sortFlash === "priority" ? COLORS.primary : COLORS.text)}>優先順位の設定どおり</button>
          </div>
        </Overlay>
      )}

      {/* 自信度ポップアップ */}
      {popupWord && (
        <Overlay onClose={() => setPopupWord(null)}>
          <div style={{ fontWeight: "bold", fontSize: "17px", marginBottom: "16px", textAlign: "center" }}>{popupWord.word}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button onClick={() => setConfidence(popupWord.id, "low")} style={confBtnStyle("#e53935")}>自信がない</button>
            <button onClick={() => setConfidence(popupWord.id, "high")} style={confBtnStyle("#02ccbb")}>自信あり（もう出題しない）</button>
            <button onClick={() => setConfidence(popupWord.id, "none")} style={confBtnStyle("#bbb")}>未設定に戻す</button>
          </div>
        </Overlay>
      )}

      {/* 編集モーダル */}
      {editing && (
        <Overlay onClose={() => setEditing(null)}>
          <div style={{ fontWeight: "bold", fontSize: "16px", marginBottom: "14px", textAlign: "center" }}>単語を編集</div>
          <input value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} onKeyDown={(e) => e.key === "Enter" && saveEdit()} autoFocus style={{ width: "100%", padding: "12px", borderRadius: "10px", border: `1px solid ${COLORS.line}`, fontSize: "15px", marginBottom: "8px", boxSizing: "border-box" }} />
          <div style={{ fontSize: "12px", color: COLORS.muted, marginBottom: "16px" }}>※生成済みの例文はそのまま残ります。</div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => setEditing(null)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: `1px solid ${COLORS.line}`, background: "#fff", color: COLORS.sub, fontWeight: "bold", cursor: "pointer" }}>やめる</button>
            <button onClick={saveEdit} disabled={!editing.value.trim()} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: editing.value.trim() ? COLORS.text : "#ccc", color: "#fff", fontWeight: "bold", cursor: editing.value.trim() ? "pointer" : "default" }}>保存</button>
          </div>
        </Overlay>
      )}

      {/* 削除確認モーダル */}
      {confirmDelete && (
        <Overlay onClose={() => setConfirmDelete(null)}>
          <div style={{ fontSize: "15px", color: COLORS.text, fontWeight: "bold", lineHeight: 1.7, marginBottom: "6px", textAlign: "center" }}>
            「{confirmDelete.word}」を削除しますか？
          </div>
          <div style={{ fontSize: "12px", color: COLORS.muted, marginBottom: "20px", textAlign: "center" }}>※生成済みの例文も一緒に削除されます。</div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: `1px solid ${COLORS.line}`, background: "#fff", color: COLORS.sub, fontWeight: "bold", cursor: "pointer" }}>やめる</button>
            <button onClick={doDeleteWord} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: "#d9534f", color: "#fff", fontWeight: "bold", cursor: "pointer" }}>削除する</button>
          </div>
        </Overlay>
      )}

      {/* 自分で選んで出題 */}
      {showSelectModal && (
        <div onClick={() => setShowSelectModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: "16px", width: "88%", maxWidth: "360px", maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "18px 20px 10px", textAlign: "center" }}>
              <div style={{ fontWeight: "bold", fontSize: "17px" }}>出題する単語を選ぶ</div>
              <div style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>生成済みからタップで選択（{selectedIds.length}/{WORDS_PER_SESSION}）</div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", borderTop: "1px solid #eee", borderBottom: "1px solid #eee" }}>
              {words.filter((w) => w.generated).length === 0 ? (
                <div style={{ padding: "24px", textAlign: "center", color: COLORS.muted, fontSize: "13px" }}>生成済みの単語がありません</div>
              ) : (
                words.filter((w) => w.generated).map((w) => {
                  const checked = selectedIds.includes(w.id)
                  return (
                    <div key={w.id} onClick={() => toggleSelect(w.id)} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 18px", borderBottom: "1px solid #f0f0f0", cursor: "pointer", background: checked ? "#e6f9f7" : "white" }}>
                      <span style={{ width: "20px", height: "20px", borderRadius: "6px", border: checked ? "none" : "2px solid #ccc", background: checked ? "#02ccbb" : "white", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "13px", flexShrink: 0 }}>{checked ? "✓" : ""}</span>
                      <span style={{ fontWeight: "bold", fontSize: "15px", color: "#333" }}>{w.word}</span>
                      <div style={{ marginLeft: "auto", display: "flex", gap: "12px" }}>
                        <span style={{ width: "14px", height: "14px", borderRadius: "50%", background: w.done ? LEARNED_COLOR : UNLEARNED_COLOR }} />
                        <span style={{ width: "14px", height: "14px", borderRadius: "50%", background: CONFIDENCE_COLORS[confOf(w)] }} />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            <div style={{ display: "flex", gap: "10px", padding: "14px 20px" }}>
              <button onClick={() => setShowSelectModal(false)} style={{ flex: 1, padding: "12px 0", borderRadius: "10px", border: "1px solid #ddd", background: "white", color: "#555", fontSize: "15px", fontWeight: "bold", cursor: "pointer" }}>キャンセル</button>
              <button onClick={startSelected} disabled={selectedIds.length === 0} style={{ flex: 1, padding: "12px 0", borderRadius: "10px", border: "none", background: selectedIds.length === 0 ? "#ccc" : COLORS.text, color: "white", fontSize: "15px", fontWeight: "bold", cursor: selectedIds.length === 0 ? "default" : "pointer" }}>GO</button>
            </div>
          </div>
        </div>
      )}

      {/* 優先順位の設定（ドラッグ） */}
      {showSortSettings && (
        <div onClick={closeSortSettings} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: "16px", padding: "20px", width: "88%", maxWidth: "360px" }}>
            <div style={{ fontWeight: "bold", fontSize: "17px", textAlign: "center", marginBottom: "4px" }}>優先順位の設定</div>
            <div style={{ fontSize: "12px", color: "#888", textAlign: "center", marginBottom: "16px" }}>上ほど先に出題（つまんで並べ替え）</div>
            <div style={{ position: "relative" }}>
              {order.map((key, i) => {
                const b = BUCKETS[key]
                const isDragging = i === dragIndex
                return (
                  <div key={key} onPointerDown={(e) => startDrag(e, i)} onPointerMove={onDragMove} onPointerUp={endDrag} onPointerCancel={endDrag}
                    style={{ height: `${ROW_H - 8}px`, marginBottom: "8px", display: "flex", alignItems: "center", gap: "10px", padding: "0 12px", borderRadius: "10px", background: "#f4f6f8", border: "1px solid #e6e8ea", boxSizing: "border-box", touchAction: "none", userSelect: "none", cursor: "grab", transform: isDragging ? `translateY(${dragOffset}px)` : "none", transition: isDragging ? "none" : "transform 0.12s", boxShadow: isDragging ? "0 4px 12px rgba(0,0,0,0.18)" : "none", position: "relative", zIndex: isDragging ? 2 : 1, opacity: isDragging ? 0.95 : 1 }}>
                    <span style={{ color: "#bbb", fontSize: "17px" }}>≡</span>
                    <span style={{ display: "flex", gap: "6px" }}>
                      <span style={{ width: "13px", height: "13px", borderRadius: "50%", background: b.done ? LEARNED_COLOR : UNLEARNED_COLOR }} />
                      <span style={{ width: "13px", height: "13px", borderRadius: "50%", background: CONFIDENCE_COLORS[b.conf] }} />
                    </span>
                    <span style={{ fontSize: "14px", color: "#333" }}>{b.label}</span>
                  </div>
                )
              })}
            </div>
            <button onClick={closeSortSettings} style={{ width: "100%", marginTop: "8px", padding: "12px 0", borderRadius: "10px", border: "none", background: "#02ccbb", color: "white", fontSize: "15px", fontWeight: "bold", cursor: "pointer" }}>保存して閉じる</button>
          </div>
        </div>
      )}

      {selectToast && (
        <div style={{ position: "fixed", bottom: "90px", left: "50%", transform: "translateX(-50%)", background: "rgba(50,50,50,0.9)", color: "#fff", borderRadius: "16px", padding: "12px 20px", fontSize: "14px", fontWeight: 500, whiteSpace: "nowrap", zIndex: 1100 }}>{selectToast}</div>
      )}

      <Navigation />
    </div>
  )
}

function Overlay({ children, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: "16px", padding: "20px", width: "80%", maxWidth: "300px" }}>{children}</div>
    </div>
  )
}

function Center({ children }) {
  return <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.sub }}>{children}</div>
}
