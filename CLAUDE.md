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

## Astro テンプレートでの記法
- Alpine.js の `@click`, `@htmx:before-request.window` 等 **`@` ショートハンドはそのまま使ってよい**
- htmx の `hx-on` イベント属性は **`:` ではなく `--`（ハイフン2つ）記法を使う**
  - OK: `hx-on--after-request="..."`
  - NG: `hx-on::after-request="..."`

## CSS ルール
- **CSS は直書きせず PandaCSS を使う**（`index.css` のみ例外）
- コンポーネント間で共有するスタイルは `styles.css.ts` にまとめる
- API レスポンスの HTML 断片にも PandaCSS クラスを使う（AstroContainer 経由なのでカバーされる）

## API 設計方針
- JSON は使わず、**htmx による HTML 断片の受け渡し**で CRUD を行う
- API ルートからの HTML 生成には **AstroContainer** (`experimental_AstroContainer`) を使い、Astro コンポーネントを `renderToString` する
- HTML テンプレートを API ルートに直書きしない — コンポーネントに分離する
