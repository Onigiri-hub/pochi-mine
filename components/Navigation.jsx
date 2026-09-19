// 画面下部の固定ナビ（Pochi本家の見た目に合わせたダークバー＋白アイコン）。
import { useRouter } from "next/router"

const TABS = [
  { href: "/", label: "HOME", icon: "/images/icons/home_fff.svg", alt: "ホーム", match: [] },
  { href: "/words", label: "WORDS", icon: "/images/icons/honekko_fff.svg", alt: "並べて英単語", match: ["/practice"] },
  { href: "/myStory", label: "READING", icon: "/images/icons/book_fff.svg", alt: "MY長文", match: ["/myStoryForm", "/storyPlay"] },
  { href: "/talk", label: "TALK", icon: "/images/icons/talk_fff.svg", alt: "AIとおはなし", match: ["/talkRoom"] },
  { href: "/settings", label: "SETTINGS", icon: "/images/icons/settings_fff.svg", alt: "設定", match: ["/backup"] },
]

function isActive(pathname, tab) {
  if (tab.href === "/") return pathname === "/"
  if (pathname === tab.href) return true
  return (tab.match || []).some((p) => pathname === p || pathname.startsWith(p))
}

export default function Navigation() {
  const router = useRouter()

  return (
    <div className="navOuter">
      <div className="navInner">
        {TABS.map((t) => {
          const active = isActive(router.pathname, t)
          return (
            <button
              key={t.href}
              onClick={() => router.push(t.href)}
              className="navItem"
              style={{ opacity: active ? 1 : 0.55 }}
            >
              <img src={t.icon} alt={t.alt} />
              <span className="label">{t.label}</span>
            </button>
          )
        })}
      </div>

      <style jsx>{`
        .navOuter {
          position: fixed;
          bottom: 0;
          left: 0;
          width: 100%;
          background: #333333;
          z-index: 1000;
        }
        .navInner {
          max-width: 400px;
          margin: 0 auto;
          height: 60px;
          display: flex;
          justify-content: space-around;
          align-items: center;
        }
        .navItem {
          background: none;
          border: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          color: white;
          padding: 5px;
        }
        .navItem img {
          width: 24px;
          height: 24px;
          object-fit: contain;
          margin-bottom: 2px;
        }
        .label {
          font-size: 10px;
          font-weight: bold;
          color: #ebebeb;
          letter-spacing: 0.02em;
        }
      `}</style>
    </div>
  )
}
