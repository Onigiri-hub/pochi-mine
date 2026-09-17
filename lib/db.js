// IndexedDB の初期化（idb ラッパー）。
// ブラウザ専用。SSR時に触れないよう getDB() は遅延初期化にする。
//
// ストア構成（データ設計どおり）:
//   settings  keyPath:"key"（単一レコード key:"app"。provider/apiKey/既定値。移行対象外）
//   words     keyPath:"id"（単語＋状態 generated/done/confidence/createdAt）
//   sentences keyPath:"id" + index by_word(wordId)（単語の例文 {en,ja,answer,chips,audio}）
//   stories   keyPath:"id"（My長文。sentences配列を埋め込み）

import { openDB } from "idb"

export const DB_NAME = "pochi-mine"
export const DB_VERSION = 3
// データ移行JSONの互換管理用（DB_VERSION とは別軸で、エクスポート形式のバージョン）
export const SCHEMA_VERSION = 1

let dbPromise = null

export function getDB() {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    throw new Error("IndexedDB はブラウザでのみ利用できます")
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore("settings", { keyPath: "key" })
          db.createObjectStore("words", { keyPath: "id" })
          const sentences = db.createObjectStore("sentences", { keyPath: "id" })
          sentences.createIndex("by_word", "wordId")
          db.createObjectStore("stories", { keyPath: "id" })
        }
        if (oldVersion < 2) {
          // AIとはなそう（会話履歴）
          db.createObjectStore("chats", { keyPath: "id" })
        }
        if (oldVersion < 3) {
          // 日別のトークン使用量（keyPath は JST日付 "YYYY-MM-DD"）
          db.createObjectStore("usage", { keyPath: "date" })
        }
      },
    })
  }
  return dbPromise
}
