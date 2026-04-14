# メルカリ物販 学習問題化アプリ

画像と補足情報をもとに Gemini で学習問題を生成し、LINE で毎日出題して、正解/不正解に応じて次回出題日を自動調整する自分専用の学習支援 Web アプリです。

## できること

- 管理画面から商品ごとに画像最大4枚、補足情報、自由メモ、初回送信予定日を登録
- 保存時に Gemini へ画像とテキストを送り、問題文・模範解答・解説・要点・難易度を生成
- 問題一覧、問題詳細、編集、再生成、今すぐ送信
- LINE webhook で `解答` `正解` `不正解` を処理
- 正解なら7日後、不正解なら翌日に次回送信日を更新
- `npm run send:due` で本日送信対象をまとめて送信
- Prisma + PostgreSQL で学習データを保持し、Vercel では Vercel Blob に画像を保存

## 技術スタック

- Next.js 16 / App Router / TypeScript
- Tailwind CSS
- Prisma 7 + PostgreSQL
- Zod
- Google Gemini API
- LINE Messaging API
- date-fns / date-fns-tz
- Vitest

## 画面

- ダッシュボード: 総問題数、今日送信予定、未送信件数、正解数、不正解数、直近ログ、今日送る予定の問題
- 新規登録: 画像、商品情報、補足情報、自由メモ、初回送信予定日を登録して問題生成
- 問題一覧: 検索、状態絞り込み、今日送信対象のみ表示、今すぐ送信、再生成、編集
- 問題詳細: 画像、要約、問題文、模範解答、解説、難易度、送信/回答履歴、次回送信日変更

## セットアップ手順

1. 依存関係をインストール

```bash
npm install
```

2. 環境変数を確認

```bash
cp .env.example .env
```

この作業ではローカル起動用の `.env` も配置済みです。値を変える場合は `.env` を編集してください。
`GEMINI_API_KEY` や LINE 関連の環境変数が未設定でも、管理画面の起動と閲覧自体は可能です。

3. DB を初期化

```bash
npm run db:push
npm run db:seed
```

4. 開発サーバーを起動

```bash
npm run dev
```

5. ブラウザで開く

- URL: `http://localhost:3000`
- Basic 認証: `.env` の `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD`
- 初期値: `admin / change-me`

## 必要な環境変数

| 変数名 | 必須 | 用途 |
| --- | --- | --- |
| `DATABASE_URL` | 必須 | アプリ実行時に使う PostgreSQL 接続文字列 |
| `DIRECT_URL` | Prisma CLI利用時に推奨 | `prisma migrate` / `prisma db push` 用の直結 PostgreSQL 接続文字列 |
| `BASIC_AUTH_USER` | 推奨 | 管理画面の Basic 認証ユーザー名 |
| `BASIC_AUTH_PASSWORD` | 推奨 | 管理画面の Basic 認証パスワード |
| `APP_BASE_URL` | LINE画像送信時に必須 | 現在有効な HTTPS 公開URL |
| `UPLOAD_STORAGE_DIR` | ローカル保存時のみ任意 | Blob を使わない環境での画像保存先絶対パス |
| `BLOB_READ_WRITE_TOKEN` | Vercel本番で必須 | Vercel Blob への画像保存トークン |
| `GEMINI_API_KEY` | 問題生成時に必須 | Gemini Developer API キー |
| `GEMINI_MODEL` | 任意 | 既定は `gemini-2.5-flash` |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE返信/送信時に必須 | Messaging API のチャネルアクセストークン |
| `LINE_CHANNEL_SECRET` | webhook受信時に必須 | Messaging API のチャネルシークレット |
| `LINE_DEFAULT_USER_ID` | push送信時に推奨 | 単一ユーザー運用時の既定送信先 LINE userId |
| `CRON_SECRET` | 内部API利用時に必須 | `/api/internal/send-due` の認証用 |
| `APP_TIMEZONE` | 任意 | 既定は `Asia/Tokyo` |
| `MAX_UPLOAD_SIZE_MB` | 任意 | 画像1枚あたりの上限 MB |

## Gemini API キーの設定方法

1. Google AI Studio で Gemini API キーを発行
2. `.env` の `GEMINI_API_KEY` に設定
3. 必要なら `GEMINI_MODEL` を変更

問題生成は以下のタイミングで実行されます。

- 新規登録の保存時
- 問題詳細 / 一覧の「問題再生成」

`GEMINI_API_KEY` が空だと、登録や再生成時に明示的なエラーを返します。

## LINE Developers 側で設定する箇所

1. Messaging API のチャネルを作成
2. `Channel access token` を発行し、`.env` の `LINE_CHANNEL_ACCESS_TOKEN` に設定
3. `Channel secret` を `.env` の `LINE_CHANNEL_SECRET` に設定
4. Webhook URL を設定

```text
https://<公開URL>/api/line/webhook
```

5. `Use webhook` を有効化
6. 実運用時は LINE Official Account Manager 側の自動応答が競合しないよう調整
7. 自分の LINE userId を `.env` の `LINE_DEFAULT_USER_ID` に設定

`LINE_DEFAULT_USER_ID` は push 配信用です。未設定でも、DB上の対象ユーザーに `lineUserId` が入っていれば送信できます。
単一ユーザーMVPとして運用する場合は `.env` に設定しておくのが安全です。

## ローカルでの Webhook 確認方法

ローカルの `localhost` は LINE から直接叩けないため、公開トンネルを使います。
この手順は開発確認用です。Vercel 本番では公開URLがそのまま Webhook に使えます。

例: Cloudflare Tunnel

```bash
cloudflared tunnel --url http://localhost:3000
```

例: ngrok

```bash
ngrok http 3000
```

発行された HTTPS URL を LINE Developers の Webhook URL に設定してください。
問題文と一緒に画像も LINE へ送る場合は、同じ HTTPS URL を `.env` の `APP_BASE_URL` に設定してください。

## 毎日送信処理の実行方法

手動実行:

```bash
npm run send:due
```

内部 API を叩く方法:

```bash
curl -X POST \
  -H "x-cron-secret: change-me" \
  http://localhost:3000/api/internal/send-due
```

強制送信で当日再送したい場合:

```bash
curl -X POST \
  -H "x-cron-secret: change-me" \
  "http://localhost:3000/api/internal/send-due?force=1"
```

本番では Vercel Cron などから内部 API を呼ぶ構成にすると扱いやすいです。

## Vercel 本番運用

Vercel で永続運用する場合は、アプリ本体以外を外部サービスへ切り出します。

- Web アプリ: Vercel
- DB: Neon / Vercel Postgres / Supabase などの PostgreSQL
- 画像: Vercel Blob
- 定期送信: Vercel Cron または外部 cron から `/api/internal/send-due` を呼び出す

最低限必要な環境変数の例:

```env
DATABASE_URL="postgresql://<pooled-connection>"
DIRECT_URL="postgresql://<direct-connection>"
APP_BASE_URL="https://sedori-gakusyuu.vercel.app"
BLOB_READ_WRITE_TOKEN="<vercel-blob-token>"
```

`DIRECT_URL` が設定されていれば、Prisma CLI はそちらを優先して使います。Neon のように pooled URL と direct URL が分かれるサービスでそのまま使えます。

ローカルの既存 SQLite データを移す場合は、Postgres のスキーマ反映後に以下を実行します。

```bash
npm run db:push
npm run migrate:sqlite-to-postgres
```

必要に応じて `SQLITE_DATABASE_PATH` で元DBの場所を指定してください。画像は移行時に Vercel Blob へアップロードされます。

旧来の SQLite + 永続ディスク前提で動かしたい場合は、VPS 用テンプレートも残しています。

- ひな形 env: [deploy/vps/env.production.example](/Users/kukkiiboy/Desktop/Codex/★260318★物販LINE学習/deploy/vps/env.production.example)
- セットアップ手順: [deploy/vps/README.md](/Users/kukkiiboy/Desktop/Codex/★260318★物販LINE学習/deploy/vps/README.md)

## 主な npm scripts

```bash
npm run dev         # 開発サーバー
npm run build       # 本番ビルド
npm run start       # 本番起動
npm run lint        # ESLint
npm run test        # Vitest
npm run check       # lint + test + build
npm run db:push     # DB スキーマ反映
npm run db:seed     # ダミーデータ投入
npm run db:studio   # Prisma Studio
npm run send:due    # 本日送信対象をまとめてLINEへ送信
```

## データの保存先

- DB: `DATABASE_URL` で指定した PostgreSQL
- アップロード画像: `BLOB_READ_WRITE_TOKEN` があれば Vercel Blob、未設定なら `storage/uploads`
- ローカル画像表示: `/api/uploads/[...path]`

## よくあるエラー

### `Geminiの設定が不足しています`

- `.env` の `GEMINI_API_KEY` を設定してください

### `LINE返信/送信の設定が不足しています`

- `.env` の `LINE_CHANNEL_ACCESS_TOKEN` を設定してください
- webhook署名検証だけなら `LINE_CHANNEL_SECRET` も必要です
- push送信先がDBにない場合は `LINE_DEFAULT_USER_ID` も設定してください

### `LINE webhookの設定が不足しています`

- `.env` の `LINE_CHANNEL_SECRET` を設定してください

### `画像を1〜4枚アップロードしてください`

- 新規登録時は画像が必須です
- 編集時は画像未選択なら既存画像を保持します

### `画像サイズは1枚あたり4MB以下にしてください`

- `MAX_UPLOAD_SIZE_MB` を超えています
- iPhone の HEIC 画像などはサイズが大きい場合があります

### `認証が必要です`

- Basic 認証のユーザー名/パスワードを `.env` で確認してください

### `LINE webhook の署名検証に失敗しました`

- Webhook URL が違う
- `LINE_CHANNEL_SECRET` が違う
- LINE Developers 側のチャネルと `.env` が一致していない

### `送信先の LINE userId が未設定です`

- `.env` の `LINE_DEFAULT_USER_ID` を設定する
- もしくは対象ユーザーの `lineUserId` をDBへ登録する

### `公開URLが未設定です`

- `.env` の `APP_BASE_URL` に現在有効な HTTPS URL を設定してください
- 例: `APP_BASE_URL="https://study.example.com"`

### LINEで画像が空白になる

- `APP_BASE_URL` の公開URLが失効していると、LINEは画像を取得できません
- 開発時は `ngrok http 3000` を起動したままにしてください
- 本番時は Vercel の公開ドメインを `.env` の `APP_BASE_URL` に設定してください
- ブラウザで `APP_BASE_URL/api/uploads/...?...` を開いて画像が見える状態で送信してください

## テスト

以下を確認済みです。

- `npm run lint`
- `npm run test`
- `npm run build`

## ローカル起動の最短手順

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

その後、`http://localhost:3000` を開いて Basic 認証を通過してください。ローカル開発では PostgreSQL が先に起動している必要があります。

## 既知の未実装 / MVPとして割り切っている点

- 複数ユーザー用の管理UIは未実装
- LINE からの画像登録は未対応
- AI 生成履歴の版管理は未実装
- 問題の一括再生成や一括編集は未実装
- LINE userId の取得を UI から行う導線は未実装

## 次に拡張するなら

1. 送信スケジュールを Vercel Cron 前提で UI から確認できるようにする
2. 複数ユーザー管理と学習対象の割り当て UI を追加する
3. AI 生成履歴と再生成差分比較を残す
4. 出題頻度を単純な翌日/7日後ではなく SRS に寄せる
5. LINE 上で簡易メニューや学習状況サマリーを返す
