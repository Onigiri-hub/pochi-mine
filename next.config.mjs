/** @type {import('next').NextConfig} */

// セキュリティヘッダ（全ルート共通）。
// このアプリはBYOK＝ユーザーのAPIキーが端末のIndexedDBにあるため、
// XSS対策として「実用版CSP」を敷く。最大の狙いは connect-src / img-src を 'self' に
// 絞ることで、万一スクリプトが注入されてもキーを外部へ送信できないようにすること。
// 外部リソース（CDN/フォント/解析）は一切使っていないので許可先は基本的に 'self' のみ。
// ※ Next.js(pages router)のハイドレーション用インラインscriptと styled-jsx のインラインstyleの
//    ため script-src / style-src は 'unsafe-inline' を許容（＝実用版）。nonce方式の厳格版は将来必要になれば。
// 開発時のみ 'unsafe-eval' を許可（Next.js/Turbopack の HMR が eval を使うため）。
// 本番ビルドは eval を使わないので付けない＝本番CSPは厳しめのまま。
const isDev = process.env.NODE_ENV !== "production"
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'"

const csp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ")

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // マイク/カメラ/位置情報などは使わないので明示的に無効化（読み上げは speechSynthesis で許可不要）
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
]

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
