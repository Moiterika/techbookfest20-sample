# techbookfest20-sample

## 概要

技術書典20で頒布の『[AHA to GoTH！](https://techbookfest.org/product/cE6L5p6DMAhM6p4QKN6K8E)』のサンプルです。

本書は、2つのモダンWebスタックを題材にした技術同人誌です。

- **AHA（Astro / HTMX / Alpine.js）**：ホットリロード付きの快適な開発体験が魅力のフロントエンドスタック
- **GoTH（Go / Templ / HTMX）**：高パフォーマンスかつシングルバイナリで配布できる堅牢なバックエンドスタック

「AHAはフロントエンド開発が快適、GoTHはバックエンドが強い。じゃあ両方使えばいいのでは？」という発想のもと、AHAで書いたコードをGoTHへ自動変換する手法を検討・実装しました。

具体的には、Astro・TypeScriptファイルを静的解析し、`.astro`ファイルや APIハンドラーから `.templ` / `.go` ファイルをルールベースで自動生成するコードジェネレーターを構築しています（※一部は手動実装が必要です）。

「自動変換でどこまでできるか」を実際に試した、実験的な一冊です。
本番適用に際しては慎重な検討をお願いしつつも、AHAとGoTHという2スタックの魅力を肌で感じていただければ幸いです。

### 主な使用技術一覧

#### AHA スタック

<img src="https://img.shields.io/badge/-Astro-BC52EE.svg?logo=astro&logoColor=white&style=plastic" alt="Astro"><img src="https://img.shields.io/badge/-Htmx-3366CC.svg?logo=htmx&logoColor=white&style=plastic" alt="HTMX"><img src="https://img.shields.io/badge/-Alpine.js-8BC0D0.svg?logo=alpinedotjs&logoColor=333333&style=plastic" alt="Alpine.js"><img src="https://img.shields.io/badge/-Tailwind_CSS-06B6D4.svg?logo=tailwindcss&logoColor=white&style=plastic" alt="Tailwind CSS"><img src="https://img.shields.io/badge/-Drizzle-C5F74F.svg?logo=drizzle&logoColor=333333&style=plastic" alt="Drizzle ORM"><img src="https://img.shields.io/badge/-Bun-000000.svg?logo=bun&logoColor=white&style=plastic" alt="Bun"><img src="https://img.shields.io/badge/-Postgresql-4169E1.svg?logo=postgresql&logoColor=white&style=plastic" alt="PostgreSQL">

#### GoTH スタック

<img src="https://img.shields.io/badge/-Go-76E1FE.svg?logo=go&style=plastic" alt="Go"><img src="https://img.shields.io/badge/-Templ-1E293B.svg?style=plastic" alt="Templ"><img src="https://img.shields.io/badge/-Htmx-3366CC.svg?logo=htmx&logoColor=white&style=plastic" alt="HTMX"><img src="https://img.shields.io/badge/-Alpine.js-8BC0D0.svg?logo=alpinedotjs&logoColor=333333&style=plastic" alt="Alpine.js"><img src="https://img.shields.io/badge/-Tailwind_CSS-06B6D4.svg?logo=tailwindcss&logoColor=white&style=plastic" alt="Tailwind CSS"><img src="https://img.shields.io/badge/-Postgresql-4169E1.svg?logo=postgresql&logoColor=white&style=plastic" alt="PostgreSQL">

## プロジェクト構成

```
aha/                - AHA スタック（Astro / HTMX / Alpine.js）
  src/              - Astro アプリケーション本体
  scripts/          - GoTH 向けコード自動生成スクリプト
goth/               - GoTH スタック（Go / Templ / HTMX）
  cmd/              - エントリーポイント
  internal/         - ビジネスロジック・生成コード
  web/              - ルーティング
  static/           - 静的ファイル
.devcontainer/      - Dev Container 設定
```

## 開発環境のセットアップ

Dev Container（VS Code / Zed）での利用を前提としています。

```bash
# Dev Container を起動後、aha ディレクトリで開発サーバーを起動
cd aha
bun install
bun run dev
```

## コード自動生成（AHA → GoTH）

AHA のコードから GoTH 向けのコードを自動生成できます。

```bash
cd aha

# Go コード生成（.astro / .ts → .templ / .go）
bun run gen:go

# 静的ファイル生成（CSS・アイコン等）
bun run gen:static

# すべて一括生成（Go コード + 静的ファイル + templ generate + go generate）
bun run gen:all
```

## Goサーバーの起動

```bash
cd goth
go run ./cmd/web/
```

または、cdせずに`./`の位置で、コード自動生成からGoサーバーの起動までできます。

```bash
# すべて一括生成し、Goサーバー起動
dev.sh
```

## 注意事項

- 自動変換は実験的な取り組みです。一部は手動実装が必要です
- このリポジトリ内のコードは、書籍執筆時からバージョンが進んでいる可能性があります

## ライセンス

Copyright 2026 Moiterika LLC.
Licensed under the MIT License.
詳細は[LICENSE](LICENSE)ファイルをご覧ください。
