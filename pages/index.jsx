// ホーム（Pochi本家スタイル）。イラスト画像そのものをボタンにする。
// 上のポチはタップで動画（わん）＋効果音が鳴る。
import { useRouter } from "next/router"
import { useEffect, useRef, useState } from "react"
import Navigation from "../components/Navigation"
import { getApiConfig } from "../lib/store"

const BUTTONS = [
  { href: "/words", img: "/images/illustrations/pochi_vocabulary.png", alt: "並べて英単語" },
  { href: "/myStory", img: "/images/illustrations/pochi_chobun.png", alt: "My長文" },
  { href: "/talk", img: "/images/illustrations/pochi_talk.png", alt: "AIとはなそう" },
]

export default function Home() {
  const router = useRouter()
  const videoRef = useRef(null)
  const wanRef = useRef(null)
  const [needsKey, setNeedsKey] = useState(false) // APIキー未設定なら注意書きを出す

  useEffect(() => {
    wanRef.current = new Audio("/sound/wan.mp3")
    wanRef.current.load()
  }, [])

  useEffect(() => {
    let alive = true
    const check = async () => {
      const cfg = await getApiConfig()
      if (alive) setNeedsKey(!cfg.provider || !cfg.apiKey)
    }
    check()
    window.addEventListener("pm:settings", check) // 設定保存で自動更新
    return () => {
      alive = false
      window.removeEventListener("pm:settings", check)
    }
  }, [])

  function playWan() {
    if (wanRef.current) {
      wanRef.current.currentTime = 0
      wanRef.current.play().catch(() => {})
    }
    if (videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play().catch(() => {})
    }
  }

  return (
    <div className="homeContainer">
      <div className="homeContent">
        <video
          ref={videoRef}
          src="/animations/wan.mp4"
          muted
          playsInline
          className="homePochi"
          onClick={playWan}
          style={{ cursor: "pointer" }}
        />
        <div className="homeName">Pochi-Mine</div>

        {needsKey && (
          <div className="homeAlert" onClick={() => router.push("/settings")}>
            APIキーの設定をしてください
          </div>
        )}

        <div className="homeButtons">
          {BUTTONS.map((b) => (
            <img
              key={b.href}
              src={b.img}
              alt={b.alt}
              className="homeBtnImg"
              onClick={() => router.push(b.href)}
            />
          ))}
        </div>

        <div className="homeManual" onClick={() => router.push("/help")}>
          Pochi-Mineのトリセツはこちら
        </div>
      </div>

      <Navigation />

      <style jsx>{`
        .homeContainer {
          background: #ebebeb;
          min-height: 100vh;
          display: flex;
          justify-content: center;
        }
        .homeContent {
          width: 100%;
          max-width: 400px;
          background: #ebebeb;
          min-height: 100vh;
          padding: 40px 20px 100px;
          box-sizing: border-box;
        }
        .homePochi {
          display: block;
          width: 150px;
          height: 150px;
          object-fit: contain;
          margin: 0 auto 5px;
        }
        .homeName {
          text-align: center;
          font-size: 14px;
          font-weight: bold;
          color: #585858;
          letter-spacing: 0.05em;
          margin-bottom: 24px;
        }
        .homeAlert {
          text-align: center;
          font-size: 13px;
          font-weight: bold;
          color: #e53935;
          margin: -14px 0 22px;
          cursor: pointer;
        }
        .homeButtons {
          display: flex;
          flex-direction: column;
          gap: 20px;
          align-items: center;
        }
        .homeBtnImg {
          width: 70%;
          height: auto;
          display: block;
          cursor: pointer;
          border-radius: 16px;
          transition: transform 0.1s;
        }
        .homeBtnImg:active {
          transform: scale(0.95);
        }
        .homeManual {
          text-align: center;
          font-size: 14px;
          font-weight: bold;
          color: #e8963c;
          text-decoration: underline;
          margin-top: 28px;
          cursor: pointer;
        }
        .homeManual:active {
          opacity: 0.6;
        }
      `}</style>
    </div>
  )
}
