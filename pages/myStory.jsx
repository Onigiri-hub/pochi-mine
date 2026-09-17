// My長文の一覧。Pochi-next の myStoryList（レッスン一覧の見た目）に寄せた。
// イラスト背景ヘッダー ＋ 丸アイコンの lessonRow ＋ ⋯メニュー（改名/削除モーダル）＋ 下部の作成ボタン。
import { useEffect, useState } from "react"
import { useRouter } from "next/router"
import Navigation from "../components/Navigation"
import { listStories, deleteStory, updateStory } from "../lib/store"

export default function MyStory() {
  const router = useRouter()
  const [stories, setStories] = useState(null)
  const [menuOpenId, setMenuOpenId] = useState(null)     // ⋯メニューを開いている story
  const [confirmDelete, setConfirmDelete] = useState(null) // 削除確認中
  const [renameTarget, setRenameTarget] = useState(null)   // 名前変更中
  const [renameValue, setRenameValue] = useState("")
  const [renaming, setRenaming] = useState(false)

  async function reload() {
    setStories(await listStories())
  }
  useEffect(() => {
    reload()
  }, [])

  async function handleDelete(id) {
    await deleteStory(id)
    setConfirmDelete(null)
    reload()
  }

  function openRename(story) {
    setRenameValue(story.title || "")
    setRenameTarget(story)
  }
  async function handleRename() {
    if (!renameTarget || renaming) return
    setRenaming(true)
    await updateStory(renameTarget.id, { title: renameValue.trim() })
    setRenaming(false)
    setRenameTarget(null)
    reload()
  }

  return (
    <div className="lessonList" style={{ paddingBottom: "80px" }}>
      <div style={{ position: "relative", margin: "12px 0 26px" }}>
        <button
          onClick={() => router.push("/")}
          style={{ position: "absolute", left: 0, top: 0, background: "none", border: "none", fontSize: "15px", fontWeight: "bold", color: "#333333", cursor: "pointer", padding: "4px 8px" }}
        >
          ◀
        </button>
        <div style={{ textAlign: "center", paddingTop: "2px" }}>
          <div style={{ fontWeight: "bold", fontSize: "18px", color: "#333333" }}>My長文</div>
          <img src="/images/illustrations/section_underbar.png" alt="" style={{ display: "block", width: "100%", height: "auto", margin: "2px auto 0", pointerEvents: "none" }} />
        </div>
      </div>

      {stories === null ? (
        <div style={{ padding: "24px 20px", textAlign: "center", color: "#aaa", fontSize: "14px" }}>読み込み中…</div>
      ) : stories.length === 0 ? (
        <div style={{ padding: "24px 20px", textAlign: "center", color: "#888888", fontSize: "14px", lineHeight: 1.7 }}>
          自分だけの長文で並べ替え問題を作ってみよう！<br />
          下のボタンから、英語または日本語の文章を入力してね。
        </div>
      ) : (
        stories.map((s) => (
          <div className="lessonRow" key={s.id} style={{ position: "relative", zIndex: menuOpenId === s.id ? 30 : undefined }}>
            <div
              className="lessonIcon"
              style={{ backgroundColor: "#e8963c" }}
              onClick={() => router.push(`/storyPlay?id=${s.id}`)}
            >
              <img src="/images/icons/practice_icon.png" className="iconImage" />
            </div>
            <div className="lessonInfo" onClick={() => router.push(`/storyPlay?id=${s.id}`)}>
              <div className="lessonName">{s.title || "無題の長文"}</div>
              <div className="lessonSub">
                {s.sentences?.length || 0}文
                {s.done && <span> ・練習済み</span>}
                {s.confidence > 0 && <span> ・自信度 {"★".repeat(s.confidence)}</span>}
              </div>
            </div>

            {/* 三点リーダー（⋯）→ 改名/削除メニュー */}
            <button
              className="dotsBtn"
              onClick={(e) => { e.stopPropagation(); setMenuOpenId((prev) => (prev === s.id ? null : s.id)) }}
              aria-label="メニュー"
            >
              ⋯
            </button>

            {menuOpenId === s.id && (
              <div className="rowMenu">
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); openRename(s) }}
                  style={{ borderBottom: "1px solid #eee", color: "#333" }}
                >
                  名前を変更
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); setConfirmDelete(s) }}
                  style={{ color: "#d9534f" }}
                >
                  削除
                </button>
              </div>
            )}
          </div>
        ))
      )}

      {/* 新しい長文を作る（リストの下） */}
      <div style={{ padding: "16px 20px" }}>
        <button onClick={() => router.push("/myStoryForm")} className="createBtn">
          ＋ 新しい長文を作る
        </button>
      </div>

      {/* ⋯メニューを閉じる透明バックドロップ */}
      {menuOpenId && (
        <div onClick={() => setMenuOpenId(null)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
      )}

      {/* 名前変更モーダル */}
      {renameTarget && (
        <div className="modalBg" onClick={() => setRenameTarget(null)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: "15px", color: "#333", fontWeight: "bold", marginBottom: "14px", textAlign: "center" }}>
              名前を変更
            </div>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              placeholder="タイトル"
              autoFocus
              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ccc", fontSize: "15px", marginBottom: "18px", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: "10px" }}>
              <button className="modalBtn modalCancel" onClick={() => setRenameTarget(null)}>やめる</button>
              <button className="modalBtn modalOk" onClick={handleRename} disabled={renaming} style={{ background: renaming ? "#ccc" : "#333333" }}>
                {renaming ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {confirmDelete && (
        <div className="modalBg" onClick={() => setConfirmDelete(null)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: "15px", color: "#333", fontWeight: "bold", lineHeight: 1.7, marginBottom: "20px", textAlign: "center" }}>
              「{confirmDelete.title || "無題の長文"}」を削除しますか？
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button className="modalBtn modalCancel" onClick={() => setConfirmDelete(null)}>やめる</button>
              <button className="modalBtn" onClick={() => handleDelete(confirmDelete.id)} style={{ background: "#d9534f", color: "#fff", border: "none" }}>削除する</button>
            </div>
          </div>
        </div>
      )}

      <Navigation />

      <style jsx>{`
        .lessonList {
          max-width: 400px;
          margin: auto;
          padding: 20px;
          background: #ebebeb;
          min-height: 100vh;
        }
        .lessonRow {
          display: flex;
          align-items: center;
          margin: 20px 0;
          padding-left: 8px;
        }
        .lessonIcon {
          width: 60px;
          height: 60px;
          min-width: 60px;
          min-height: 60px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 0 rgba(0, 0, 0, 0.1);
          transition: transform 0.12s;
        }
        .lessonIcon:active {
          transform: scale(0.92);
        }
        .iconImage {
          width: 32px;
          height: 32px;
          object-fit: contain;
        }
        .lessonInfo {
          margin-left: 18px;
          flex: 1;
          min-width: 0;
          cursor: pointer;
        }
        .lessonName {
          font-size: 16px;
          font-weight: bold;
          color: #333;
          margin-bottom: 4px;
        }
        .lessonSub {
          font-size: 11px;
          color: #999;
        }
        .dotsBtn {
          margin-left: auto;
          background: none;
          border: none;
          font-size: 22px;
          line-height: 1;
          color: #888;
          cursor: pointer;
          padding: 4px 8px;
        }
        .rowMenu {
          position: absolute;
          top: 50%;
          right: 8px;
          transform: translateY(-50%);
          background: #fff;
          border: 1px solid #e0e0e0;
          border-radius: 10px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
          z-index: 20;
          overflow: hidden;
        }
        .rowMenu button {
          display: block;
          width: 100%;
          padding: 12px 24px;
          background: none;
          border: none;
          font-size: 15px;
          font-weight: bold;
          cursor: pointer;
          white-space: nowrap;
          text-align: left;
        }
        .createBtn {
          width: 100%;
          padding: 16px;
          border-radius: 999px;
          border: none;
          background: #333333;
          color: #fff;
          font-size: 17px;
          font-weight: bold;
          cursor: pointer;
          transition: transform 0.1s;
        }
        .createBtn:active {
          transform: scale(0.97);
        }
        .modalBg {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          z-index: 1000;
        }
        .modalCard {
          background: #fff;
          border-radius: 16px;
          padding: 24px 20px;
          max-width: 340px;
          width: 100%;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        }
        .modalBtn {
          flex: 1;
          padding: 13px;
          border-radius: 12px;
          font-weight: bold;
          font-size: 15px;
          cursor: pointer;
        }
        .modalCancel {
          border: 1px solid #ccc;
          background: #fff;
          color: #666;
        }
        .modalOk {
          border: none;
          color: #fff;
        }
      `}</style>
    </div>
  )
}
