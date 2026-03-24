# aha プロジェクト

## 技術スタック
- **ランタイム**: Bun（Node.js直接実行は不可）
- **フレームワーク**: Astro 6 (SSR, `output: "server"`)
- **アダプタ**: @nurodev/astro-bun
- **DB**: PostgreSQL（devcontainer の `db` サービス, devdb/postgres/password）
- **ORM**: Drizzle ORM（postgres.js ドライバ）
- **CSS**: PandaCSS（`styled-system/` に生成、`css()` で利用）
- **クライアント**: htmx + Alpine.js

## コマンド
- **dev**: `bunx --bun astro dev`（`bun run dev`）
- **astro CLI**: 必ず `bunx --bun astro <command>` で実行する（`astro` 直接や `bunx astro` は Node.js バージョン不足でエラーになる）
- **PandaCSS codegen**: `bunx panda codegen`
- **Drizzle push**: `bunx drizzle-kit push`
- **型生成**: `bunx --bun astro sync`
- **フォーマット**: `bun fmt`（Prettier — .astro, .ts を整形）

## Astro テンプレートでの記法
- Alpine.js の `@click`, `@htmx:before-request.window` 等 **`@` ショートハンドはそのまま使ってよい**
- htmx の `hx-on` イベント属性は **`:` ではなく `--`（ハイフン2つ）記法を使う**
  - OK: `hx-on--after-request="..."`
  - NG: `hx-on::after-request="..."`

## CSS ルール
- **CSS は直書きせず PandaCSS を使う**（`index.css` のみ例外）
- **共通スタイルは `src/styles/common.css.ts` に定義**し、各コンポーネントから import して使う
  - ボタン: `btnPrimary`, `btnSecondary`, `btnDanger`
  - フォーム: `inputStyle`, `inputStyleSm`, `labelStyle`
  - カード: `card`, `cardTitle`
  - テーブル: `thCell`, `tdCell`, `row`
  - ユーティリティ: `flexRow`, `errorText`, `pageContainer`, `pageTitle`
- **各コンポーネントでボタンや入力欄のスタイルをインライン `css()` で書かない** — `common.css.ts` の定義を使う
- そのコンポーネント固有のレイアウト調整（gap, margin 等）のみインライン `css()` で書いてよい
- API レスポンスの HTML 断片にも PandaCSS クラスを使う（AstroContainer 経由なのでカバーされる）

## API 設計方針
- JSON は使わず、**htmx による HTML 断片の受け渡し**で CRUD を行う
- API ルートからの HTML 生成には **AstroContainer** (`experimental_AstroContainer`) を使い、Astro コンポーネントを `renderToString` する
- HTML テンプレートを API ルートに直書きしない — コンポーネントに分離する
