# 聖書メッセージクリップ (PWA)

Google Driveに保存された礼拝メッセージ/説教音声を、クリップ（しおり・メモ）付きで聞きやすくするPWAです。

## 主要機能 (MVP)
- Googleログイン (Google Identity Services)
- Driveから音声ファイル選択 (Google Picker優先 / 代替: Drive API一覧)
- 音声プレイヤー (再生/停止/10秒戻し/30秒送り/シーク/速度変更)
- クリップポイント作成/編集/削除/ジャンプ
- クリップ/履歴/設定の永続化 (IndexedDB)
- PWA対応 (manifest + service worker + オフライン起動)

## 画面構成
- `/` ホーム: ログイン・Drive選択・最近開いた音源
- `/player/:fileId` 再生/クリップ
- `/settings` 設定

静的ホスティングでの404回避のため `HashRouter` を使用しています。
実際のURLは `/#/player/:fileId` 形式になります。

## セットアップ

### 1) 依存関係インストール
```bash
npm install
```

### 2) 環境変数
`.env.example` をコピーして `.env` を作成し、Google Cloudの設定を入れてください。
```bash
copy .env.example .env
```

必要な値:
- `VITE_GOOGLE_CLIENT_ID`: OAuthクライアントID
- `VITE_GOOGLE_API_KEY`: Google Picker用APIキー (Drive API有効化)
- `VITE_GOOGLE_APP_ID`: Picker用アプリID (プロジェクト番号, 任意)

Google Cloud Consoleで次を有効化してください:
- Google Drive API
- Google Picker API

スコープは `drive.readonly` + `openid` + `userinfo.profile` を使用しています。
- `drive.readonly`: Drive音声を読み取り専用で取得
- `userinfo.profile`: `sub` 取得のため (クリップ/履歴のキーに利用)
- `openid`: ユーザー識別子の取得に必要

OAuthトークンは **localStorageに保存せず、メモリ上でのみ保持** します。

### 3) 開発サーバー起動
```bash
npm run dev
```

### 4) ビルド
```bash
npm run build
```

### 5) プレビュー
```bash
npm run preview
```

## デプロイ (GitHub Pages)
`vite.config.ts` は `base: "./"` を設定しているため、GitHub Pagesのサブパスでも動作します。
`dist/` をそのまま GitHub Pages にデプロイしてください。

## データ保存
- クリップ・履歴・設定は IndexedDB に保存されます。
- キー設計は `driveFileId + user(sub) + clipId` を使用して衝突回避しています。

## Drive音声の取得方式
MVPでは以下の方式です:
- `GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media`
- `Authorization: Bearer <token>` を付与して取得
- Blob化して `URL.createObjectURL` で再生

将来的に巨大ファイル向けのRange対応やストリーミング再生へ拡張できるよう、該当箇所にTODOコメントを残しています。

## TODO (将来拡張)
- 音声の部分ダウンロード/Range対応
- クリップの共有 (URLやテキスト書き出し)
- クラウド同期 (Drive/Firestore等)
- クリップ検索/タグ機能

## 注意事項
- Google Pickerが使えない環境では、Drive API一覧表示にフォールバックします。
- オフライン時はアプリシェルのみ起動可能で、音声自体のオフライン保存は未対応です。