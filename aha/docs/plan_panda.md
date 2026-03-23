# PandaCSS → GoTH CSS可搬性アーキテクチャ

## Context

参考プロジェクト（Tailwind）では `@tailwindcss/cli` が .templ ファイルもスキャンしてCSSを生成できる。AHAプロジェクト（PandaCSS）では、AstroContainer がコンポーネントをレンダリングする時点でクラス名は解決済みなので、**templ ファイル生成時にクラス名マッピングは不要**。残る課題は「PandaCSS が生成した CSS をどう GoTH 側に渡すか」に絞られる。

## css() vs cva() vs recipes — 結論

| 選択肢 | 判定 | 理由 |
|--------|------|------|
| **css() + common.css.ts（現行）** | **維持** | AstroContainer で解決済み。GoTH 側に影響なし |
| cva() | 移行不要 | バリアント選択は AstroContainer が解決。Go 側での再実装不要 |
| PandaCSS config recipes | 移行不要 | 同上。CSS出力への影響もなし |

**AstroContainer が全てを解決する前提では、css()/cva()/recipes のどれを使っても GoTH への可搬性は同じ。** AHA 開発の使いやすさで選べばよい。現行の css() + common.css.ts パターンはシンプルで十分。

## CSS 抽出方法

### コマンド

```bash
bunx panda cssgen --outfile dist/css/panda.css --minify
```

これで完全なスタイルシートが出力される（確認済み、約1040行）。内容:
- `@layer reset` — CSS リセット
- `@layer base` — 基本スタイル
- `@layer tokens` — デザイントークン（CSS変数: `--colors-indigo-600`, `--spacing-2` 等）
- `@layer utilities` — 原子クラス（`.fs_sm`, `.bg_indigo\.600`, `.hover\:bg_indigo\.700` 等）

### 仕組み

PandaCSS の静的解析が `panda.config.ts` の `include` グロブ（`./src/**/*.{ts,astro}`）をスキャンし、使用されている `css()` 呼び出しのプロパティ/値から必要なユーティリティクラスだけを生成する。AstroContainer が出力する HTML の class 属性と、この CSS ファイルのクラス定義が一致する。

## ビルドパイプライン

```
Step 1: bunx panda codegen
        → styled-system/ を最新化（css() 関数等）

Step 2: bunx panda cssgen --outfile dist/css/panda.css --minify
        → GoTH 用 CSS ファイル出力

Step 3: bun build（htmx, alpine のバンドル）
        → dist/js/htmx.js, dist/js/alpine.js

Step 4: bun scripts/gen-templ.ts
        → AstroContainer でレンダリング → templ 化
        → dist/templ/*.templ, dist/handler/handlers.go
        ※ class 属性は AstroContainer が解決済み

Step 5: templ generate ./dist/templ/
        → .templ → _templ.go

Step 6: go build
```

### package.json への追加

```json
{
  "scripts": {
    "build:goth": "bunx panda codegen && bunx panda cssgen --outfile dist/css/panda.css --minify && bun scripts/gen-templ.ts"
  }
}
```

## GoTH 側での CSS 配信

```go
// layout.templ
<link rel="stylesheet" href="/static/css/panda.css" />
```

```go
// main.go — 静的ファイル配信
mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("dist"))))
```

## 出力ディレクトリ構造

```
dist/
├── css/
│   └── panda.css       ← Go サーバが配信する PandaCSS スタイルシート
├── templ/
│   ├── item_row.templ  ← AstroContainer → templ 変換結果（クラス名は解決済み文字列）
│   └── ...
├── handler/
│   └── handlers.go     ← 生成された Go ハンドラ
└── js/
    ├── htmx.js
    └── alpine.js
```

## templ ファイルでのクラス属性（例）

AstroContainer でレンダリングされた HTML:
```html
<tr class="trs_all_0.2s hover:bg_slate.50 [&.htmx-swapping]:op_0">
  <td class="py_3 px_4 bd-b_1px_solid bd-c_slate.200 c_slate.700 fs_sm">名前</td>
  <td class="py_3 px_4 bd-b_1px_solid bd-c_slate.200 c_slate.700 fs_sm">
    <button class="fs_sm py_1.5 px_3 bdr_md ... bg_rose.600 c_white">削除</button>
  </td>
</tr>
```

これがそのまま templ の class 属性になる。動的部分（props による条件分岐）のみ `templ.KV()` 等で対応。

## 注意事項

- **クラス名のドット/特殊文字**: `bg_indigo.600` → CSS では `.bg_indigo\.600` とエスケープ。HTML の class 属性ではそのまま記述して問題なし
- **@layer**: `panda.css` は layer 宣言を含む。Go 側で追加 CSS を使う場合は panda.css の後に読み込む
- **CSS変数**: tokens レイヤーが `--colors-*`, `--spacing-*` 等の CSS 変数を定義。utilities はこれらを参照する。panda.css 1ファイルで完結
- **`--minify` オプション**: 本番用に minify 推奨。開発時は外して可読性を保つ

## 検証方法

1. `bunx panda cssgen --outfile dist/css/panda.css` 実行後、HTML で使われるクラス名が CSS に含まれることを確認:
   ```bash
   # 例: common.css.ts の btnPrimary が使うクラスを検証
   grep 'bg_indigo' dist/css/panda.css
   ```
2. 生成した panda.css を単体の HTML ファイルで読み込み、AstroContainer 出力の HTML 断片を貼り付けて見た目が同じか確認
3. GoTH サーバ起動後、ブラウザの DevTools Network タブで panda.css が正しく配信されていることを確認
