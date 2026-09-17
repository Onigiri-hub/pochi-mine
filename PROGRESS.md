# Pochi-Mine 進捗メモ

> このファイルは Claude の永続メモ（`~/.claude/.../memory/pochi-mine-project.md`）のミラーです。
> プロジェクト直下でも読めるように置いています。最終更新: 2026-09-16

Pochi-Mine — Pochi-Next の前に作る軽量MVP。2026-09-15に構想開始。

**★現在地（2026-09-16時点・区切り）:** 3機能（並べて英単語／My長文／きままにTALK）が全部動作＋Vercel本番デプロイ済み（**https://pochi-mine.vercel.app**）。2026-09-16はUI磨き込みフェーズ2（下記参照）＝共通タイトルヘッダー統一・My長文一覧刷新・storyPlay刷新・練習系にNavigation追加まで完了。ローカルdevは`C:\my_apps\e-apps\Pochi-mine`で`npm run dev`（http://localhost:3000）。
**次の再開候補:** ①talkRoom/talk一覧など会話画面の本家寄せ ②本番の「生成」UX設計 ③配布前にUpstashレート制限のenv設定 ④チャット履歴のバックアップ対象化。

**目的:** サーバーコストほぼゼロで基本無償提供できるPochiの軽量版。Pochi-Nextの重量級機能を出す前にコスト構造を検証する位置づけ。

**搭載機能（Pochi-Nextの一部を移植）:**
- 「並べて英単語」の自分で単語を登録するモード
- 「My長文」
- 「AIとはなそう」

**確定した設計方針:**
- **BYOK**: AI英文・和訳生成はユーザー自身が取得したAPIキーで動く。プロバイダーはユーザーが好きなものを選べるマルチ対応（Claude / OpenAI / Gemini など）。
- **接続方式**: ブラウザ直叩きはしない。安全性重視で **ステートレスな薄いVercelプロキシ**経由（キーは受け取って転送するだけ・保存もログもしない）。CORSやAnthropicのブラウザ直叩き非推奨問題を回避するため。
- **Vercelコスト**: Fluid Computeにより、ストリーム待ちの時間は実CPU課金から切り離されるので安い。転送はテキストのみで軽い。Hobby無料枠〜Pro低額に収まる想定。
- **TTS**: Web Speech API（無料・キー不要）。自作単語やMy長文は既存MP3が無いため。
- **保存**: 端末ローカル（IndexedDB想定）。機種変・別端末用にデータ移行/コピーボタンを付ける（JSONエクスポート/インポート）。
- **着せ替え・モフ機能は無し。**

**キーの扱い（確定）:** プロキシ側では一切保存しない。初回に設定画面で入力→IndexedDBに保存（端末内のみ）→生成のたびにHTTPSでプロキシへ送り、中継後に破棄。永続保存先はユーザー端末だけ。XSS対策としてCSPを固める方針（凝るならオプションでパスフレーズ暗号化）。

**レート制限（確定）:** 入れる。Upstash Redis（無料枠）＋@upstash/ratelimitでIP単位。守る対象はVercel計算枠（AI課金はユーザーのキー持ち）なので緩めでOK。将来ProならVercel Firewallのルールに寄せてもよい。

**データ規模想定:** 英単語~500 / 例文~2000 / 長文200語×30。合計約1.3MBでIndexedDBには誤差レベル。移行用JSONも数MB。

**運用:** とりあえず非商用（Hobby）。課金の可能性が出たらVercel Proを検討。

**データ設計（確定・2026-09-15）:** DB名`pochi-mine`、IndexedDB 4ストア。既存Pochi-nextの文オブジェクト`{id,en,ja,answer,chips,audio}`と互換にして`PracticeEngine`を流用。audioは常にnull（再生時Web Speech）。
- `settings`（keyval1件）: provider / apiKey（端末のみ・非移行）/ defaultCount(1〜4) / difficulty / tone / schemaVersion。difficulty/toneは既存lib/difficulty.jsを流用。
- `words`（keyPath:id）: word / requestedCount(1〜4) / generated / done / confidence / createdAt。
- `sentences`（keyPath:id, index:by_word=wordId）: 単語の例文。en/ja/answer(=en)/chips(en を`|`分割)/audio(null)。answer・chipsはクライアント生成。
- `stories`（keyPath:id）: My長文。sentences配列を埋め込み。title/inputLang/done/confidence/createdAt。

**AIが返すのはenとjaのみ:** `{sentences:[{en,ja}]}`。長さ=requestedCount。answer/chips/id/audioはクライアントで付与。

**移行/コピー（確定）:** words+sentences+stories+schemaVersionをJSONエクスポート/インポート。**APIキーは含めない**（新端末で入れ直す。移行ファイルに秘密を乗せない）。

**フォルダ:** `C:\my_apps\e-apps\Pochi-mine`（Pochi/Pochi-demo/Pochi-nextと横並び）。Next.js 16.1.6 pages router・React 19、Firebaseなし（ローカルファースト）。

---

## 実装ログ

**ステップ1（プロキシ）:** `lib/llm.js`（BYOK版provider抽象化。claude/openai/gemini対応。エラー正規化。既定モデル claude-haiku-4-5 / gpt-4o-mini / gemini-3.1-flash-lite）、`lib/rateLimit.js`（Upstash・未設定なら自動無効）、`lib/apiError.js`、`lib/difficulty.js`。`POST /api/generate/word`・`/api/generate/story`。実AI疎通確認済み（Gemini）。

**ステップ2（IndexedDBアクセス層）:** `idb`使用。`lib/db.js`（4ストア＋sentences.by_word）、`lib/sentence.js`（buildSentence）、`lib/store.js`（settings/words/sentences/stories CRUD、saveGeneratedSentencesは1txでgenerated=true）、`lib/backup.js`（export/import・キー非含）。`/dbtest`にセルフテスト。

**ステップ3コア一本（UI）:** `lib/ui.js`/`lib/practice.js`/`lib/api.js`/`utils/ttsPlayer.js`/`components/Navigation.jsx`。`pages/index.jsx`(ホーム)・`settings.jsx`(provider/APIキー/接続テスト)・`words.jsx`(登録/生成)・`practice.jsx`(並べ替え)。

**My長文:** `pages/myStory.jsx`(一覧)・`myStoryForm.jsx`(生成)・`storyPlay.jsx`(プレビュー→並べ替え→完了)。Pochi-next流用をBYOK＋IndexedDB＋Web Speech化。上限 en300語/ja1000字。

**移行・コピー画面:** `pages/backup.jsx`（書き出し=ファイル保存＋コピー／取り込み=ファイル＋貼り付け・マージ）。設定に導線。

**当初要件①〜⑤を一通り実装:** ①並べて英単語＋My長文＋AIとはなそう ②BYOK ③ローカル保存＋移行/コピー ④Vercel最小(静的＋薄いプロキシ・Fluid Compute) ⑤着せ替え/モフ無し。

**AIとはなそう（仕様）:** フリートークのみ。ユーザーは主に日本語で話しかける→AIは短くやさしい英語で返す（1〜3文・各6〜12語・毎回質問・訂正なし）。AI発話は一文ずつ、各文に🔊＋▼和訳＋単語タップ意味。ストリーミング逐次表示、履歴はIndexedDBに保存して再開。
- Step1: DB v2＋`chats`ストア、`lib/llm.js`にstreamChat（3社統一）、`pages/api/chat.js`、`talk.jsx`/`talkRoom.jsx`。
- Step2: `/api/translate`・`/api/wordMeaning`、talkRoomに▼和訳（message.trにキャッシュ）＋単語タップ意味（セッションキャッシュ）。

**トークン/回数の可視化＋上限:**
- 実数トークン集計（各社usage正規化{input,output,total}、ストリーミングも捕捉）。chatはストリーム末尾に`\n[[USAGE]]`＋JSON。
- DB v3 `usage`ストア（keyPath=JST日付）。addUsageで requests も+1（回数集計）。
- `components/TokenMeter.jsx`：右上常時表示。トークン＋回数を上限バー付きで（80%警告色/超過赤）。k/M表記。
- 設定に上限3種：1日トークン / 1日リクエスト回数 / 1か月トークン（月次は右上に出さず設定で確認、JST月初リセット）。上限は目安（超えても止めない）。

**誤字対策:** 専用チェックは作らず（トークン増ゼロ）。単語生成に相乗りで正しい綴りを`word`で返させ、違えばラベル自動更新。＋手動リネーム(✏️)。

**参考(2026-09時点・要再確認):** Gemini 3.1 Flash-Lite 無料枠 30 RPM・1,500 RPD、有料 入力$0.25/出力$1.50 per 1M。出力は入力の約6倍。1操作=1リクエスト（単語生成は1単語=1回）。

---

## UI（Pochi本家寄せ）

**Navigation:** 下部ダークバー#333・白アイコン24px・max-width400・高さ60。アイコン: home_fff→HOME、honekko_fff→WORDS、book_fff→READING(My長文)、talk_fff→TALK、settings_fff→SETTINGS。現在地タブ強調＋サブ画面もmatchで点灯。

**ホーム:** 上に`animations/wan.mp4`（タップで再生＋`sound/wan.mp3`）、下にイラスト画像そのものがボタン（pochi_vocabulary/pochi_chobun/pochi_talk・幅70%・タップで縮む）。設定はナビへ。

**並べて英単語ページ（arrangeSectionList寄せ）:** ヘッダー／出題2ボタン「上から順番にやる！」「自分で選んで出題」／ツールバー（左:単語登録・開閉式フォーム／右:並べ替え・優先順位）／単語リスト。各行=単語＋生成済み/未生成＋●2つ(やった/自信度タップ)＋✏️/×＋暫定「生成」。並べ替えは登録日順/アルファベット/優先順位、優先順位はドラッグ設定(6バケツ)。practice複数単語対応(`?wordIds=`)。自信度はリストの●で設定（練習完了時の入力は廃止）。

**練習画面（arrangePractice寄せ）:** styled-jsxで本家CSS移植。灰チップ(押すとピョコッ)・点線chipBox・progressDots・下部バー(正解#02ccbb/不正解#ff9600)・Perfect！/惜しい！・Check→Next/Try again・ポチ吹き出し。効果音: チップ=pa.mp3、正解=seikai.mp3。出題時に英語をWeb Speech自動再生（リスニング先行）＋🔊。正解時の再読み上げは無し。
- 下部バーは400px中央寄せ、`styles/globals.css`でbody背景#ebebeb統一（サイドの白フチ解消）。スマホ<400pxは全幅。

**完了画面:** `components/CompleteScreen.jsx`（`animations/animation-great.mp4`＋`sound/kirakira.mp3`＋「次へ」#02ccbb）。practice/storyPlay両方で使用。モフ/バッジ等は無し。

---

## デプロイ

**Vercelデプロイ済み（2026-09-15、最新2026-09-17）:** アカウント`onigiri-hub`、チーム`onigiri3`、プロジェクト`pochi-mine`（要小文字なので明示link）。git不使用・Vercel CLI直デプロイ。**安定URL: https://pochi-mine.vercel.app**。必須env無し（BYOK）。更新は`vercel --prod --yes --scope onigiri3`をこのフォルダで再実行（⚠️`--scope onigiri3`が無いと`Not authorized`になる）。2026-09-17にUI磨き込みフェーズ2込みで再デプロイ済み。
- スマホ注意: IndexedDBはオリジンごとで新規（PCデータは移行/コピーで持ち運び、キーは入れ直し）。レート制限オフ（Upstash未設定）＝広く配布前にUpstash推奨。

---

## トラブル対処メモ

- devサーバーは全コードが揃った後にクリーン起動すること（起動後にexport追加＋build併走でTurbopackが古いキャッシュを掴み「X is not a function」500になった実績あり）。対処: port3000のプロセスをStop-Process→`.next`削除→`npm run dev`再起動。

---

## UI磨き込みフェーズ2（2026-09-16）

devで全ページ200コンパイル確認。

- **共通タイトルヘッダー統一:** words「並べて英単語」/ myStory「My長文」/ talk のタイトルを同一レイアウトに＝相対コンテナに◀を`position:absolute;left:0`、中央18px bold、直下に`section_underbar.png`（`width:100%`）。共通コンポーネント化はせずインライン複製。
- **talkタイトル変更:** 「AIとはなそう」→「きままにTALK」（ナビTALKラベル/ホームpochi_talkは据え置き）。
- **My長文一覧(myStory.jsx)刷新:** Pochi-next myStoryList寄せ。丸オレンジアイコン(`practice_icon.png`をnextからコピー)のlessonRow＋⋯メニュー（名前変更=updateStory/削除、アプリ内モーダル）＋下部ダーク作成ボタン。styled-jsx。
- **myStoryForm生成中:** ✍️→`pochi-tokotoko.mp4`動画。
- **storyPlay:** プレビュー本文＝白ボックス廃止→背景なし・左寄せ・線の内側(`padding:4px 34px`)。英文/日本語表示の下線を`section_underbar.png`画像に、トグル間隔34px。学習開始ボタン#333。タイトル横の全文再生を🔊→`speaker-333.svg`(再生中⏸)。並べ替えフェーズを practice.jsx と同一化（吹き出し/ドット/灰チップ/点線box/下部バー/効果音/Navigation）。出題時に英語1回自動再生・解答後の読み上げ無し。
- **練習系にNavigation:** practice.jsx と CompleteScreen.jsx の下部にNavigation。practice下部バーは`bottom:60px`でnavの上に載せ重なり回避、`.app`の`padding-bottom:240px`。CompleteScreenは`paddingBottom:84px`。
- **talkRoom:** 全幅→`max-width:400px`中央寄せ＋`paddingBottom:60px`＋下部Navigation。入力バーの白塗り＋区切り線を透明化、送信ボタン#333333。AI発話/ポップアップの🔊を`speaker-333.svg`、和訳トグル▼を#333333。
- **設定画面 全面再編:** `API設定`/`並べて英単語設定`/`生成英文設定`の3カテゴリ開閉式アコーディオン。例文数=並べて英単語のみ、英語レベル=全機能に反映で分離。保存ボタン廃止＝入力の都度自動保存(`persist(patch)`)。接続テストボタンに色（キー有効時オレンジ）。※`LimitInput`/`Section`はモジュールscope（フォーカス落ち防止）。
- **words.jsxアイコンsvg化:** ペン→`edit_888.svg`、並べ替え→`swap_333.svg`、優先順位→`settings_333.svg`。
- **並べ替えメニューの押した感:** 3ボタン全部#333333、タップ項目だけ`sortFlash`でオレンジ→500ms後に閉じる。3関数を`applySort(key)`に統合。

**UI検証メモ:** IndexedDB依存画面はheadless一発スクショだと読込前で撮れない。→`chrome --headless=new --remote-debugging-port=9222 --user-data-dir=<temp>`＋Node(global WebSocket)自作CDPで deleteDatabase→アプリ再訪でDB再作成→seed→撮影。DB upgradeは基底ストアを`oldVersion<1`でのみ作成＝壊れた空v1が残るとwords等が作られないのでdeleteDatabase必須。chromeは起動PIDだけkill（`/IM chrome.exe`はユーザーのChromeも巻き込む）。設定画面など**DB seed不要な画面はheadless一発スクショでOK**（`--headless=new --window-size=520,760 --screenshot`）。

---

## 機能追加フェーズ3（2026-09-17・build成功＆本番デプロイ済み）

最新デプロイ dpl_5SLpe15Wpi1TEdkVAQ5eGwUh7kWL・READY。デプロイは必ず`vercel --prod --yes --scope onigiri3`（スコープ無しは`Not authorized`）。

- **TALKユーザー入力に▼英語変換:** talkRoomのUserBubble右に▼開閉→白ボックスで英語版＋🔊。日本語→英訳「英語で言うと」／英語→自然な英語「自然な言い方」。ラベルはクライアント正規表現で判定、変換は1エンドポイント両対応。結果は`message.en`にキャッシュ（IndexedDB保存）。新規`pages/api/refine.js`（{provider,apiKey,model,text}→{en}）＋`lib/api.js`の`refineToEnglish`。
- **バックアップ拡張:** `lib/backup.js`のexport/importに`settings`（★apiKey除外）＋`usage`（日別）を追加。設定と使用済みトークン量（当日/当月）を引き継ぎ。usageは日付キー上書き・settingsはマージ（既存キーは壊さない）。★`chats`(TALK)は対象外＝TALK履歴は引き継がれない旨をbackup.jsxに明記。
- **AI返答の自動読み上げ:** talkRoomの`send()`完了時に`playAllWebSpeech`で新規返答を自動再生（履歴再訪では鳴らない）。
- **削除モーダル統一:** words(単語×)/talk(会話×)の`confirm`を長文と同じアプリ内モーダルに（やめる／赤`#d9534f`削除する）。各`confirmDelete`state。wordsは例文連鎖削除の注記付き・`Overlay`流用、talkはインライン。
- **HOMEのAPIキー未設定アラート:** index.jsx「Pochi-Mine」下に、未設定なら朱書き`#e53935`「APIキーの設定をしてください」（タップで/settings）。`pm:settings`購読で自動消去。
- **設定画面の見出し:** `Section`の下線をオレンジborder→`section_underbar.png`（width:100%・要素右端は入力欄とフラッシュ、画像はユーザー調整済み）。タイトル中央寄せ・矢印は閉▼/開▲・上余白34px。★カテゴリ**初期状態を全部閉じる**に変更。

---

## Upstashレート制限 本番有効化（2026-09-17）

配布前ゲートの1つを完了。**IP単位30回/60秒のスライディングウィンドウが本番で稼働**。実測で429を確認済み。

- **コード:** `lib/rateLimit.js`をenv名2系統に両対応化＝`UPSTASH_REDIS_REST_URL/TOKEN`（従来）に加え、Marketplace版が注入する`KV_REST_API_URL/TOKEN`も読む（`url = UPSTASH... || KV...`）。他は無改修（全6ルートで`checkRateLimit`呼び出し済み）。
- **Upstash作成:** Vercel Marketplace「Upstash for Redis」(`upstash/upstash-kv`)を`vercel integration add upstash/upstash-kv --scope onigiri3`で作成（初回は規約同意URLをブラウザで承認→再実行）。リソース名`upstash-kv-fulvous-bridge`、`pochi-mine`に接続、free枠。env（`KV_REST_API_URL`/`KV_REST_API_TOKEN`他）がProduction/Preview/Developmentに自動注入。
- **レート値env:** `RATE_LIMIT_MAX=30`・`RATE_LIMIT_WINDOW_SEC=60`をProductionに`vercel env add`で追加。
- **デプロイ:** `vercel --prod --yes --scope onigiri3`（dpl_2tQRXMknCG5ZpLHhtabojTRgDtfE・READY）。
- **検証:** 空ボディで`/api/translate`を35連打→1〜30回=400(invalid_provider＝制限通過)、31回目〜=429(rate_limited)。時間経過でwindowが回復し単発は400に戻る＝スライディングウィンドウ正常。※rate_limitチェックはボディ検証より前なので実キー/トークン消費ゼロで検証可能。
- ⚠️`.env.local`にUpstashのトークンが入った（`vercel env pull`が上書き）。`.gitignore`済みなので流出なし。

---

## 配布前整備＋PWA/エラー整備（2026-09-17・developブランチ）

git導入済み（`git init -b main`→初回コミット→**develop**で作業。デプロイは従来通りCLI直で、GitHub連携なし）。

**A. CSP＋規約（commit `7de78bd`・本番デプロイ済み dpl_FxveCw558t1uKeLtMunFNECyCmN1）**
- **CSP＋セキュリティヘッダ（実用版）:** `next.config.mjs`の`headers()`で全ルートに付与。狙いは`connect-src 'self'`＝万一XSSが起きてもAPIキーを外部送信できないようにする。script-src/style-srcは`'unsafe-inline'`許容（pages routerのインラインscript＋styled-jsx）。dev時のみ`'unsafe-eval'`（Turbopack HMR用・本番は無し）。＋`X-Content-Type-Options`/`Referrer-Policy`/`X-Frame-Options DENY`/`Permissions-Policy`。本番起動＋headless CDPでCSP違反0・描画正常を検証済み。ソースに`dangerouslySetInnerHTML`/`eval`無し＝注入口ほぼ無し。厳格版(nonce)は将来サードパーティscript/HTML描画を足したら検討。
- **規約ページ:** `pages/terms.jsx`（「規約とポリシー」＝本家terms.jsxの見た目踏襲、利用規約9条＋プライバシー7条をBYOK/ローカル保存に合わせて改変）。設定画面の一番下にリンク。⚠️**運営者名`ミエリカ・ワークス`＋連絡先`mierika.works@gmail.com`は雛形＝配布名義に合わせ要編集**（terms.jsxの`OPERATOR`/`CONTACT`）。
- **AI送信注意書き:** TALK空状態＋単語登録フォームに追加（myStoryFormと統一）。

**B. ②エラー種別で出し分け＋①PWA化（本番デプロイは未）**
- **②エラー出し分け:** `lib/errorMessage.js`の`describeError(e)`で invalid_key/content_blocked/rate_limited/unavailable/server_error＋**オフライン/通信断(codeなし)** を判別し `{title,message,action}` を返す（サーバーの日本語detailは尊重、invalid_key系は「設定を開く」導線つき）。共通表示 `components/ErrorNotice.jsx`。words(alert()廃止→genError)/myStoryForm/talkRoom の主要生成導線に適用。APIキー未設定の`confirm()`も missing_api_key Error に統一。
- **①PWA化:** `public/manifest.webmanifest`（standalone/theme #e8963c/bg #ebebeb）＋`public/icons/`（pochi.pngからsharpで192/512/maskable512/apple-touch180生成）＋`_app.js`にHead(manifest/theme-color/apple-touch)＋SW登録（**本番のみ**・`document.readyState==='complete'`なら即登録＝load後マウントのレース対策）。`public/sw.js`＝軽量自作SW（/api/*は常時ネット・静的アセットcache-first・ナビはnetwork-firstでオフライン時キャッシュ）。CSP `default-src 'self'`と相性OK。headless検証: SW active/manifest有効/theme-color/CSP違反0を確認。**next-pwa不使用**（Turbopack相性回避）。

---

## 未実装（次の候補）
- **③ 英文生成レベルのCEFR細分化（設計保留中）**：CEFR6段階案が有力だが未確定。`lib/difficulty.js`の2段階(everyday/business)を拡張予定。実装は未着手（ユーザーが設計検討中）。

- talk会話一覧の行デザインをmyStory式（丸アイコン＋⋯メニュー）に ※削除モーダル化は済、行の丸アイコン化は未
- 本番の生成UX（今は未生成行の暫定「生成」ボタン）※ユーザー判断で「やらない確定」
- チャット履歴(chats)のバックアップ対象化 ※現状は意図的に対象外（UIに明記済み）
- ~~Upstashレート制限のenv設定（配布前）~~ → **2026-09-17完了（上記）**
