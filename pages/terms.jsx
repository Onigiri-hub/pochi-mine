// 規約とポリシー（利用規約＋プライバシーポリシー）。
// Pochi本家 terms.jsx の見た目を踏襲。ただし Pochi-Mine は Firebase なし・アカウント不要・
// BYOK（ユーザー自身のAPIキー）・学習データは端末ローカル(IndexedDB)保存、という前提に内容を合わせている。
// ★運営者名・連絡先は雛形。実際の配布名義に合わせて編集してください。
import { useRouter } from "next/router"
import Navigation from "../components/Navigation"
import { COLORS } from "../lib/ui"

const OPERATOR = "ミエリカ・ワークス" // ★配布名義に合わせて編集
const CONTACT = "mierika.works@gmail.com" // ★連絡先に合わせて編集
const UPDATED = "2026年9月"

const h3 = { fontSize: "16px", borderBottom: "1px solid #eee", paddingBottom: "5px", marginTop: "20px" }
const h3center = { ...h3, textAlign: "center", marginTop: 0 }

export default function Terms() {
  const router = useRouter()

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, paddingBottom: "90px" }}>
      <div style={{ padding: "10px 20px" }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", fontSize: "15px", fontWeight: "bold", color: COLORS.text, cursor: "pointer" }}>◀</button>
      </div>
      <div style={{ textAlign: "center", fontSize: "20px", fontWeight: "bold", color: COLORS.text, margin: "4px 0 20px" }}>
        規約とポリシー
      </div>

      <div style={{ maxWidth: "440px", margin: "0 auto", padding: "0 18px" }}>
        {/* ============ 利用規約 ============ */}
        <div style={{ fontSize: "14px", lineHeight: "1.8", color: "#333" }}>
          <h3 style={h3center}>利用規約</h3>
          <p>最終更新日：{UPDATED}</p>
          <p>本規約は、{OPERATOR}（以下「当方」）が提供する英語学習アプリ「Pochi-Mine」（以下「本サービス」）の利用条件を定めるものです。</p>

          <h3 style={h3}>第1条（サービス内容）</h3>
          <p>本サービスは、自分で登録した単語やあなたの長文、AIとの会話を通じて英語を練習できる学習アプリです。</p>
          <p>個人開発によるベータ版であり、予告なく仕様が変わることがあります。</p>

          <h3 style={h3}>第2条（利用条件）</h3>
          <p>年齢制限はありません。</p>
          <p>ただし、13歳未満のお子様は、保護者の同意のもとご利用ください。</p>
          <p>ユーザーは本規約に同意の上、本サービスを利用するものとします。</p>

          <h3 style={h3}>第3条（APIキー・AI利用について）</h3>
          <p>本サービスは、ユーザーご自身が用意したAIサービス（Claude・OpenAI・Gemini等）のAPIキーを使って動作します（BYOK方式）。</p>
          <p>APIキーはお使いの端末内にのみ保存され、当方のサーバーには保存されません。</p>
          <p>英文生成・翻訳・会話の際、入力内容はユーザーが選んだAIサービスへ送信されます。</p>
          <p>AIの利用料金は、ユーザーとAIサービス提供者との契約に基づき、ユーザーのご負担となります。</p>

          <h3 style={h3}>第4条（入力内容の責任）</h3>
          <p>入力内容はAIサービスに送信されます。個人情報・機密情報・第三者の権利を侵害する内容・公序良俗に反する内容は入力しないでください。</p>
          <p>入力内容および生成物の利用に関する責任は、ユーザーが負うものとします。</p>

          <h3 style={h3}>第5条（コンテンツについて）</h3>
          <p>本サービスの英文・和訳・会話などはAIを活用して生成されます。</p>
          <p>そのため内容に誤りが含まれる可能性があり、当方は正確性・完全性を保証しません。</p>

          <h3 style={h3}>第6条（データの保存）</h3>
          <p>学習データ（単語・例文・長文・会話履歴・設定など）は、お使いの端末内（ブラウザのIndexedDB）にのみ保存されます。当方のサーバーには保存されません。</p>
          <p>ブラウザのデータを消去したり別の端末・ブラウザを使うと、学習データは引き継がれません。移行・バックアップ機能でお持ち運びください。</p>

          <h3 style={h3}>第7条（サービスの変更・停止）</h3>
          <p>当方は、予告なく本サービスの内容を変更・追加・削除、または提供を停止することがあります。</p>

          <h3 style={h3}>第8条（免責事項）</h3>
          <p>当方は、以下について一切の責任を負いません。</p>
          <p>・本サービスの利用による学習成果</p>
          <p>・バグ、不具合による影響</p>
          <p>・学習データの消失・損失</p>
          <p>・APIキーやAI利用に関するトラブル・費用</p>
          <p>・その他、本サービスに関連して生じた損害</p>
          <p>個人開発のため、修正対応には限界があることをご理解ください。</p>

          <h3 style={h3}>第9条（準拠法）</h3>
          <p>本規約は日本法に準拠します。</p>
        </div>

        {/* ============ プライバシーポリシー ============ */}
        <div style={{ fontSize: "14px", lineHeight: "1.8", color: "#333", marginTop: "60px" }}>
          <h3 style={h3center}>プライバシーポリシー</h3>
          <p>最終更新日：{UPDATED}</p>

          <h3 style={h3}>第1条（収集する情報）</h3>
          <p>本サービスはアカウント登録・ログイン不要です。当方は、ユーザーを個人として識別する情報を収集しません。</p>
          <p>学習データはすべてお使いの端末内に保存され、当方はその内容にアクセスできません。</p>

          <h3 style={h3}>第2条（APIキーの取り扱い）</h3>
          <p>APIキーは端末内にのみ保存され、当方のサーバーには保存・記録されません。</p>
          <p>生成時にはHTTPS通信で当方の中継サーバーを経由してAIサービスへ送信されますが、中継の際にキーや入力内容を保存・ログ化することはありません。</p>

          <h3 style={h3}>第3条（AIサービスへの送信）</h3>
          <p>入力内容は、ユーザーが選んだAIサービス（Claude・OpenAI・Gemini等）へ送信されます。</p>
          <p>各サービスにおけるデータの取り扱いは、それぞれの提供者のポリシーをご確認ください。</p>

          <h3 style={h3}>第4条（アクセス情報の利用）</h3>
          <p>不正利用防止のため、中継サーバーへのアクセス時にIPアドレスを一時的なアクセス回数制限（レート制限）の判定に使用します。</p>
          <p>これは一時的な回数管理のみに用い、入力内容の保存には使用しません。</p>

          <h3 style={h3}>第5条（第三者サービス）</h3>
          <p>本サービスは、以下の第三者サービスを利用しています。</p>
          <p>・Vercel（ホスティング・中継）</p>
          <p>・Upstash（アクセス回数制限）</p>
          <p>・ユーザーが選んだAIサービス（Anthropic / OpenAI / Google 等）</p>

          <h3 style={h3}>第6条（第三者提供）</h3>
          <p>当方は、取得した情報を本サービスの提供目的以外では使用しません。</p>
          <p>第三者への提供は行いません（法令に基づく場合を除く）。</p>

          <h3 style={h3}>第7条（お問い合わせ）</h3>
          <p>本サービスに関するお問い合わせは、以下のメールアドレスまでご連絡ください。</p>
          <p>{CONTACT}</p>
          <p>個人運営のため、ご返信にお時間をいただく場合があります。あらかじめご了承ください。</p>
        </div>
      </div>

      <Navigation />
    </div>
  )
}
