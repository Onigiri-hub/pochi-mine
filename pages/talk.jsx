// AIとはなそう: 会話一覧。新規作成 / 再開 / 削除。
import { useEffect, useState } from "react"
import { useRouter } from "next/router"
import Navigation from "../components/Navigation"
import { listChats, createChat, deleteChat } from "../lib/store"
import { COLORS, primaryBtn } from "../lib/ui"

export default function Talk() {
  const router = useRouter()
  const [chats, setChats] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null) // 削除確認中 {id,title}

  async function reload() {
    setChats(await listChats())
  }
  useEffect(() => {
    reload()
  }, [])

  async function startNew() {
    const c = await createChat()
    router.push(`/talkRoom?id=${c.id}`)
  }

  async function doDeleteChat() {
    if (!confirmDelete) return
    await deleteChat(confirmDelete.id)
    setConfirmDelete(null)
    reload()
  }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, paddingBottom: "90px" }}>
      <div style={{ maxWidth: "440px", margin: "0 auto", padding: "12px 16px 0" }}>
        <div style={{ position: "relative", margin: "12px 0 26px" }}>
          <button onClick={() => router.push("/")} style={{ position: "absolute", left: 0, top: 0, background: "none", border: "none", fontSize: "15px", fontWeight: "bold", color: COLORS.text, cursor: "pointer", padding: "4px 8px" }}>◀</button>
          <div style={{ textAlign: "center", paddingTop: "2px" }}>
            <div style={{ fontWeight: "bold", fontSize: "18px", color: COLORS.text }}>きままにTALK</div>
            <img src="/images/illustrations/section_underbar.png" alt="" style={{ display: "block", width: "100%", height: "auto", margin: "2px auto 0", pointerEvents: "none" }} />
          </div>
        </div>

        <button onClick={startNew} style={{ ...primaryBtn(false), width: "100%", marginBottom: "18px" }}>
          ＋ 新しいおしゃべり
        </button>

        {chats === null ? (
          <div style={{ textAlign: "center", color: COLORS.muted, fontSize: "14px", marginTop: "30px" }}>読み込み中…</div>
        ) : chats.length === 0 ? (
          <div style={{ textAlign: "center", color: COLORS.muted, fontSize: "14px", marginTop: "30px", lineHeight: 1.8 }}>
            日本語で話しかけると、AIがやさしい英語で返してくれるよ。<br />
            上のボタンから始めてみよう！
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {chats.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px", borderRadius: "12px", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                <div onClick={() => router.push(`/talkRoom?id=${c.id}`)} style={{ flex: 1, cursor: "pointer" }}>
                  <div style={{ fontSize: "15px", fontWeight: "bold", color: COLORS.text }}>{c.title || "無題のおしゃべり"}</div>
                  <div style={{ fontSize: "11px", color: COLORS.muted, marginTop: "3px" }}>{c.messages?.length || 0} メッセージ</div>
                </div>
                <button onClick={() => setConfirmDelete({ id: c.id, title: c.title })} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: "18px", cursor: "pointer" }} aria-label="削除">×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 削除確認モーダル */}
      {confirmDelete && (
        <div onClick={() => setConfirmDelete(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: "16px", padding: "24px 20px", maxWidth: "340px", width: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: "15px", color: COLORS.text, fontWeight: "bold", lineHeight: 1.7, marginBottom: "20px", textAlign: "center" }}>
              「{confirmDelete.title || "無題のおしゃべり"}」を削除しますか？
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: "13px", borderRadius: "12px", border: `1px solid ${COLORS.line}`, background: "#fff", color: COLORS.sub, fontWeight: "bold", fontSize: "15px", cursor: "pointer" }}>やめる</button>
              <button onClick={doDeleteChat} style={{ flex: 1, padding: "13px", borderRadius: "12px", border: "none", background: "#d9534f", color: "#fff", fontWeight: "bold", fontSize: "15px", cursor: "pointer" }}>削除する</button>
            </div>
          </div>
        </div>
      )}

      <Navigation />
    </div>
  )
}
