# Pochi-Mine

Pochi の軽量版。**BYOK（ユーザー自身のAPIキー）＋ローカルファースト**で、サーバーコスト最小・基本無償を狙う。

- 機能: 「並べて英単語（自作単語登録）」「My長文」「AIとはなそう」（順次実装）
- AI生成: ユーザーのAPIキーで動作（Claude / OpenAI / Gemini から選択）
- 保存: 端末ローカル（IndexedDB）＋ JSONで端末間移行
- TTS: Web Speech API（無料・キー不要）
- 着せ替え・モフ機能なし

## アーキテクチャ

```
[ブラウザ] IndexedDB(単語/例文/長文/設定) + Web Speech(TTS)
    │ 生成時だけ、キーをリクエストに載せて送信
    ▼
[Vercel: 薄いプロキシ] ステートレス・キーは保存もログもしない
    provider(claude|openai|gemini) を見て各社APIへ中継
```

## プロキシAPI（実装済み・ステップ1）

いずれも `POST`。`apiKey` は保存もログもされず、生成のたびに使い捨てる。

### `POST /api/generate/word`
単語 → 例文＋和訳を生成。
```jsonc
// リクエスト
{ "provider": "claude", "apiKey": "sk-...", "word": "appreciate", "count": 3, "difficulty": "everyday" }
// レスポンス
{ "word": "appreciate", "sentences": [ { "en": "...", "ja": "..." } ] }
```

### `POST /api/generate/story`
My長文 → 並べ替え用の文リスト。
```jsonc
// リクエスト
{ "provider": "gemini", "apiKey": "...", "text": "...", "inputLang": "ja", "title": "", "difficulty": "everyday", "tone": "normal" }
// レスポンス
{ "title": "", "inputLang": "ja", "sentences": [ { "en": "...", "ja": "..." } ] }
```

`answer` / `chips` / `id` / `audio` はクライアント側で付与する（データ設計どおり）。

## セットアップ

```bash
npm install
npm run dev   # http://localhost:3000
```

レート制限（任意）は `.env.example` を参照。未設定なら無効（＝常に許可）で動く。
BYOKなのでサーバーにAI各社のキーは置かない。
