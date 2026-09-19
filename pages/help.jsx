// Pochi-Mine の使い方（トリセツ）。
// 見た目・内容はユーザー下書き（manual_draft.html）を参考に、アプリ本体の形式に合わせて作成。
// terms.jsx と同じ体裁（◀戻る・中央タイトル・Navigation）。オレンジ見出し＝一般項目、青見出し＝各モード。
import { useRouter } from "next/router"
import Navigation from "../components/Navigation"
import { COLORS } from "../lib/ui"

// 見出しスタイル（下書きHTMLの色分けを踏襲：一般=オレンジ / モード=青）
const section = { fontSize: "17px", fontWeight: "bold", color: "#ff9600", marginTop: "36px", marginBottom: "8px" }
const modeTitle = { fontSize: "17px", fontWeight: "bold", color: "#3311cc", marginTop: "36px", marginBottom: "8px" }
const body = { fontSize: "14px", lineHeight: "1.9", color: "#333", margin: "0 0 10px" }

export default function Help() {
  const router = useRouter()

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, paddingBottom: "90px" }}>
      <div style={{ padding: "10px 20px" }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", fontSize: "15px", fontWeight: "bold", color: COLORS.text, cursor: "pointer" }}>◀</button>
      </div>

      <div style={{ textAlign: "center", fontSize: "20px", fontWeight: "bold", color: COLORS.text, margin: "4px 0 20px" }}>
        Pochi-Mineのトリセツ
      </div>

      <div style={{ maxWidth: "440px", margin: "0 auto", padding: "0 20px" }}>
        <h2 style={section}>Pochi-Mineは…</h2>
        <p style={body}>
          あなたならではのトピックでAIと話したり、単語練習問題を生成してもらえる、アクティブ英語ラーニングプラットフォームです。
        </p>

        <h2 style={section}>このアプリではAIを使用します</h2>
        <p style={body}>
          このアプリを使用する際は、各自でAIのAPIキーを取得していただく必要があります。AI提供サービス（現在はGemini、ChatGPT、Claudeに対応しています）とAI-API利用の手続きを各自で行い、APIキーを取得してください。APIキーを当アプリの設定画面に入力すると、アプリが使用可能になります。AI利用料金は各自のご負担となり、AI提供サービスからユーザーに直接請求が届きます。
        </p>

        <h2 style={section}>API取得方法について</h2>
        <p style={body}>
          AI提供サービスによって、料金や取得方法が異なります。インターネットで検索していただくか、お持ちの生成AIに「AIのAPIキーが必要なアプリを使いたいんだけど、どうしたらいい？」のように質問してみてください。
        </p>

        <h3 style={modeTitle}>並べて英単語 モード</h3>
        <p style={body}>
          「並べて英単語」モードは、従来よく行われていたような「英単語↔日本語」のように対応付ける学習法ではなく、英語を実際の文の中でどのように使ったらいいかを学べる、単語並べ替えを中心とした英単語学習法です。ユーザーが入力した単語をもとに、AIが例文と並べ替え問題を指定した個数生成し、例文の並べ替えクイズをしながら単語の使い方を身につけます。
        </p>

        <h3 style={modeTitle}>MY長文 モード</h3>
        <p style={body}>
          「MY長文」モードは、長文を聞き取る練習と、一文一文をしっかり理解するための並べ替え問題を組み合わせたモードです。日本語で文章を入力して（500字まで）英語の長文を生成することもできますし、英語の長文を持ってきて（300語まで）入力することもできます。「並べ替え問題を作る」ボタンを押すことで、長文学習用のテキストを作成できます。
        </p>
        <p style={body}>
          生成されるテキストは、①英文も日本語訳も伏せて音声だけ聞いて学習する、②英文を見ながら音声を聞いて学習する、③日本語訳を読んで内容を理解したうえで音声を聞いて学習する、④「学習開始！」ボタンを押し、一文ずつ並べ替え問題をこなして文法や語彙をかみしめながら学習する、など、いろいろな学び方が可能です。
        </p>

        <h3 style={modeTitle}>きままにTALK モード</h3>
        <p style={body}>
          「きままにTALK」モードは、チャット形式でAIと対話するモードです。AIは英語で話しますが、ユーザーは日本語でも英語でもお好きなように語りかけることができます。AIの発したチャットの単語をタップすると単語の意味を見ることができ、文末の▼ボタンを押すと日本語訳を見ることができます。ユーザー自身が入力した日本語にも▼ボタンが表示され、英語ではどう言うかを確認できます。もしユーザーが頑張って英語を入力したら、▼ボタンで正しい文法や自然な言い方の例を教えてくれます。
        </p>

        <h2 style={section}>難易度設定について</h2>
        <p style={body}>
          設定画面から、生成される英文の難易度を設定できます。CEFR（ヨーロッパ言語共通参照枠）または文法を参考に難易度を指定できます。ただし、英文の自然さを優先するため、指定した難易度の範囲を超えることもあります。なお、人によりますが、難易度maxで英文生成をすると一文がとても長く複雑になるので、並べ替え問題がすごいことになります。
        </p>

        <h2 style={section}>音声再生について</h2>
        <p style={body}>
          英文の読み上げは現在、Web Speech APIを利用しています。スピードの調整などはできません。頑張って聞き取ってください。
        </p>

        <h2 style={section}>データ保存について</h2>
        <p style={body}>
          入力した単語・長文、生成したデータ、および設定（APIキーときままにTALKモードのチャットを除く）は、IndexedDBを使用してユーザーの端末に保存されます。膨大なデータ量を保存しようとするとユーザーの端末の容量を圧迫するので、ご自身で管理をお願いします。ほかの端末にデータを引き継ぎたいときは、設定画面の「データの移行・バックアップ」のボタンから引き継ぎを行ってください。引き継ぎの際はJSON形式のデータで保存されます。
        </p>

        <h2 style={section}>アプリ利用料金について</h2>
        <p style={body}>
          AI使用料金以外の、当アプリの利用料金は現在は無料です。今後、有料となる可能性もありますのでご了承ください。その場合は事前にアプリ内でお知らせいたします。
        </p>

        <h2 style={section}>AI使用量の目安について</h2>
        <p style={body}>
          AI使用量は一般的に「トークン数」でカウントされます。AI使用ごとに、どれくらいのトークンを使用したかがアプリ画面上に表示されます。この表示は毎日0時にリセットされます。設定画面から、一日のトークン使用量の目安、一か月のトークン使用量の目安、一日の生成回数の目安を設定できます。AIサービスやモデルによって料金体系（無料枠の有無、100万トークンあたりの単価等）が違います。ご自由に目安を設定し、使いすぎの防止にお役立てください。
        </p>
        <p style={{ ...body, fontWeight: "bold" }}>AIを使用するアクションは以下の通りです。</p>
        <p style={body}>
          【並べて英単語モード】単語ごとに「生成」ボタンを押したとき。並べ替え問題中の英単語を長押しして意味を調べたとき（Pochi-Mineにデフォルトで組み込まれている辞書に存在する英単語の場合はAIを使用しません）。
        </p>
        <p style={body}>
          【MY長文モード】「新しい長文を作る」で並べ替え問題を生成するとき。並べ替え問題中で単語を長押しして意味を調べたとき（並べて英単語モードと同様です）。
        </p>
        <p style={body}>
          【きままにTALK】ユーザーがコメントを入力してAIがコメントを生成したとき。▼ボタンを押して訳を見るとき。
        </p>
      </div>

      <Navigation />
    </div>
  )
}
