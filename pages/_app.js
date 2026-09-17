import "../styles/globals.css"
import { useEffect } from "react"
import Head from "next/head"
import TokenMeter from "../components/TokenMeter"

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // サービスワーカー登録（本番のみ。dev は Turbopack HMR と干渉するので登録しない）。
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return
    const register = () => navigator.serviceWorker.register("/sw.js").catch(() => {})
    // load 済み（useEffect が load より後に走るケース）なら即登録、まだなら load を待つ。
    if (document.readyState === "complete") {
      register()
    } else {
      window.addEventListener("load", register, { once: true })
      return () => window.removeEventListener("load", register)
    }
  }, [])

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#e8963c" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Pochi-Mine" />
      </Head>
      <Component {...pageProps} />
      <TokenMeter />
    </>
  )
}
