# aha プロジェクト

## 技術スタック
- **ランタイム**: Bun（Node.js直接実行は不可）
- **フレームワーク**: Astro 6 (SSR, `output: "server"`)
- **アダプタ**: @nurodev/astro-bun
- **DB**: PostgreSQL（devcontainer の `db` サービス, devdb/postgres/password）
- **ORM**: Drizzle ORM（postgres.js ドライバ）
- **CSS**: Tailwind CSS v4（`@tailwindcss/vite`）+ tailwind-variants（TV）
- **クライアント**: htmx + Alpine.js

## コマンド
- **dev**: `bunx --bun astro dev`（`bun run dev`）
- **astro CLI**: 必ず `bunx --bun astro <command>` で実行する（`astro` 直接や `bunx astro` は Node.js バージョン不足でエラーになる）
- **Drizzle push**: `bunx drizzle-kit push`
- **型生成**: `bunx --bun astro sync`
- **フォーマット**: `bun fmt`（Prettier — .astro, .ts を整形）

## Astro テンプレートでの記法
- Alpine.js の `@click`, `@htmx:before-request.window` 等 **`@` ショートハンドはそのまま使ってよい**
- htmx の `hx-on` イベント属性は **`:` ではなく `--`（ハイフン2つ）記法を使う**
  - OK: `hx-on--after-request="..."`
  - NG: `hx-on::after-request="..."`

## CSS ルール
- **CSS は Tailwind CSS のユーティリティクラスを使う**
- **デザイントークンは `src/index.css` の `@theme` で定義**（カスタムカラー: primary, error, surface 系等）
- **共通スタイルは `src/styles/common.ts` に定義**し、各コンポーネントから import して使う
  - ボタン: `button`（TV）— `button({ intent: "primary" })`, `button({ intent: "secondary" })`, `button({ intent: "danger" })`
  - フォーム: `input`（TV）— `input({ size: "default" })` / 後方互換: `inputStyle`, `inputStyleSm`, `labelStyle`
  - カード: `card`, `cardTitle`
  - テーブル: `thCell`, `tdCell`, `row`
  - ユーティリティ: `flexRow`, `errorText`, `pageContainer`, `pageTitle`
- バリアント管理には **tailwind-variants（TV）の `tv()`** を使う
- コンポーネント固有のスタイルは Tailwind クラス文字列をローカル変数に定義して使う
- API レスポンスの HTML 断片にも Tailwind クラスを使う

## API 設計方針
- JSON は使わず、**htmx による HTML 断片の受け渡し**で CRUD を行う
- API ルートからの HTML 生成には **AstroContainer** (`experimental_AstroContainer`) を使い、Astro コンポーネントを `renderToString` する
- HTML テンプレートを API ルートに直書きしない — コンポーネントに分離する
