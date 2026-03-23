# CSS デザイン定義まとめ

## PandaCSS テーマ設定

カスタムの semantic tokens / recipes / layer styles は未定義。PandaCSS の**デフォルトプリセット**をそのまま使用。

### 利用可能なデザイントークン

| カテゴリ | 内容 |
|---|---|
| **Colors** | rose, pink, fuchsia, purple, violet, indigo, blue, sky, cyan, teal, emerald, green, lime, yellow, amber, orange, red, neutral, stone, zinc, gray, slate (各50〜950) |
| **Spacing** | 0〜96 + 0.5, 1.5, 2.5, 3.5, 4.5, 5.5 |
| **Font Sizes** | 2xs〜9xl |
| **Font Weights** | thin(100)〜black(900) |
| **Radii** | xs(0.125rem)〜full(9999px) |
| **Shadows** | 2xs〜2xl + inset 系 |
| **Text Styles** | xs〜9xl |
| **Keyframes** | spin, ping, pulse, bounce |
| **Patterns** | box, flex, stack, vstack, hstack, spacer, grid, gridItem, center, wrap, container, divider 等 |
| **Breakpoints** | sm(640px), md(768px), lg(1024px), xl(1280px), 2xl(1536px) |

## プロジェクト独自の共通スタイル (`src/styles/common.css.ts`)

CSS は直書きせず PandaCSS を使う（`index.css` のみ例外）。共通スタイルは `common.css.ts` に定義し、各コンポーネントから import して使う。コンポーネント固有のレイアウト調整（gap, margin 等）のみインライン `css()` で書いてよい。

### ボタン

| 名前 | 説明 | カラー |
|---|---|---|
| `btnPrimary` | プライマリボタン | bg: indigo.600 / 白文字 |
| `btnSecondary` | セカンダリボタン | bg: 白 + border: slate.300 |
| `btnDanger` | 危険操作ボタン | bg: rose.600 / 白文字 |

共通ベース: fontSize:sm, py:1.5, px:3, rounded:md, shadow:sm, transition:0.2s

### フォーム

| 名前 | 説明 |
|---|---|
| `inputStyle` | 通常の入力欄（px:3, py:2） |
| `inputStyleSm` | テーブル内コンパクト入力欄（py:1.5, px:2.5, w:full） |
| `labelStyle` | 縦並びラベル（slate.700, gap:1.5） |

共通ベース: border:1px solid slate.300, rounded:md, fontSize:sm, focus時 indigo.500 ボーダー＋リング

### カード

| 名前 | 説明 |
|---|---|
| `card` | カードコンテナ（bg:白, rounded:xl, border:slate.200, shadow:sm, p:6） |
| `cardTitle` | カード内タイトル（fontSize:lg, fontWeight:semibold, color:slate.900） |

### テーブル

| 名前 | 説明 |
|---|---|
| `thCell` | ヘッダセル（fontSize:xs, uppercase, letterSpacing:wider, color:slate.500） |
| `tdCell` | データセル（fontSize:sm, color:slate.700, 下線:slate.200） |
| `row` | テーブル行（hover:bg slate.50, htmx-swapping 時 opacity:0） |

### ユーティリティ

| 名前 | 説明 |
|---|---|
| `flexRow` | 横並び flex（gap:2） |
| `errorText` | エラーテキスト（color:rose.600, fontSize:sm） |
| `pageContainer` | ページコンテナ（maxWidth:800px, mx:auto, py:8, px:4） |
| `pageTitle` | ページタイトル（fontSize:2xl, fontWeight:bold, mb:6） |
