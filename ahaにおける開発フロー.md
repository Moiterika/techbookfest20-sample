# aha における開発フロー

> **本文書の位置づけ**: aha プロジェクトの**標準実装規約**である。新規機能の追加はこの文書に従うこと。

## 目次

1. [実装規約](#実装規約)
2. [アーキテクチャ概要](#アーキテクチャ概要)
3. [開発部品一覧](#開発部品一覧)
4. [例1: ユーザー管理画面（単純CRUD）](#例1-ユーザー管理画面単純crud)
5. [例2: 注文管理画面（header-body形式）](#例2-注文管理画面header-body形式)

---

## 実装規約

### ルールの優先度

本文書では以下のラベルで規約の強さを区別する。

| ラベル | 意味 |
|---|---|
| **MUST** | 必須。違反は原則マージ不可 |
| **SHOULD** | 推奨。逸脱する場合は PR に理由を記載 |
| **MAY** | 任意。実装者の判断に委ねる |

### 命名規約

| 対象 | 規約 | 例 |
|---|---|---|
| Feature ディレクトリ名 | **MUST** 日本語 | `features/ユーザー/` |
| API パス | **MUST** 日本語（Feature名と一致） | `/api/ユーザー` |
| 画面 URL | **MUST** API パスから `/api` を除いた形 | `/ユーザー` |
| DB テーブル名 | **MUST** 日本語 | `ユーザー`, `注文明細` |
| DB カラム名（技術共通） | **MUST** 英語 snake_case | `id`, `created_at`, `updated_at` |
| DB カラム名（業務項目） | **MUST** 日本語 | `顧客名`, `品目コード` |
| TypeScript 型名（DB由来） | **MUST** 日本語 | `ユーザー`, `注文明細` |
| TypeScript テーブル変数名 | **MUST** 日本語＋`テーブル` サフィックス | `ユーザーテーブル`, `注文明細テーブル` |
| Feature 内ファイル名 | **MUST** エンティティ名(日本語) + 操作名(英語) | `ユーザーCreateCommand.ts` |
| Feature 内サブディレクトリ | **MUST** 英語（操作カテゴリ） | `create/`, `update/`, `delete/`, `query/` |
| config 変数名 | **MUST** 日本語 | `ユーザーカラム`, `ユーザーエンティティ` |
| Zod スキーマ名 | **MUST** 日本語 | `ユーザー作成Schema` |
| `idPrefix` / `bodyTargetId` 等 | **MUST** 英語（HTML属性のため） | `idPrefix: "user"` |

**技術共通カラムとは**: `id`（主キー）, `created_at`（作成日時）, `updated_at`（更新日時）など、どのテーブルにも存在する技術的な管理項目を指す。業務固有の項目（例: `品目ID`, `取引区分ID`）は日本語で命名する。

### バリデーション責務（MUST）

GenericCommand の各レイヤーには明確な責務境界がある。

| レイヤー | 責務 | やること | やらないこと |
|---|---|---|---|
| `schema` (Zod) | 型変換・必須・形式 | 文字列→数値変換、必須チェック、フォーマット検証 | DB アクセス、業務ロジック |
| `validate` | 業務制約 | コード重複チェック、存在確認、状態チェック | 型変換、DB 書き込み |
| `mapper` | 入力→DB引数 変換 | optional → null 変換、フィールドマッピング | バリデーション、DB アクセス |
| `command` | 永続化のみ | INSERT / UPDATE / DELETE | バリデーション、条件分岐による業務ロジック |

### API レスポンス契約（MUST）

全 API ルートは以下のレスポンス仕様に従う。

| 状況 | HTTP ステータス | レスポンス形式 | 備考 |
|---|---|---|---|
| 一覧取得成功 | `200` | HTML断片（CrudRows / HeaderBodyListRows） | `Content-Type: text/html` |
| 登録・更新成功 | `200` | HTML断片 + `HX-Trigger` ヘッダ | トースト通知を発火 |
| 削除成功 | `200` | 空レスポンス | htmx が行を DOM から除去 |
| バリデーションエラー | `422` | `<p class="${errorText}">${message}</p>` | Zod / validate 由来のエラー |
| 不正リクエスト | `400` | 空レスポンス | ID未指定、パラメータ不正など |
| 予期しない例外 | `500` | 空レスポンス | エラー詳細はサーバーログに出力。クライアントに詳細を返さない |

**トースト通知** (MUST):
```typescript
resp.headers.set("HX-Trigger", JSON.stringify({
  "show-toast": encodeURIComponent("登録しました")
}));
```
- 登録時: `"登録しました"`
- 更新時: `"更新しました"`
- 削除時: トースト不要（行が消えることで暗黙的にフィードバック）

### header-body 更新戦略

明細の更新は **DELETE & INSERT**（既存明細を全削除して再挿入）を標準とする。

- **MUST**: `onDelete: "cascade"` を明細テーブルの FK に設定すること
- **SHOULD**: 監査ログや明細単位の履歴追跡が必要な場合は、差分更新（UPSERT + 個別 DELETE）に変更し、PR にその理由を記載すること

### 例外対応ルール

本規約から逸脱する場合:

1. **MUST**: PR 説明に「規約逸脱: 〇〇」セクションを設け、逸脱箇所と理由を明記する
2. **SHOULD**: 逸脱が恒久的に必要な場合は、本文書の更新 PR も合わせて出す

---

## アーキテクチャ概要

```
ブラウザ
  │  htmx (HTML断片の受け渡し)
  ▼
Astro SSR ページ (.astro)
  │  汎用コンポーネント (CrudTable, CrudForm, SearchPanel...)
  ▼
API ルート (src/pages/api/)
  │  AstroContainer で HTML 断片をレンダリング
  ▼
Feature レイヤー (src/features/)
  │  GenericQuery / GenericCommand + Zod バリデーション
  ▼
Drizzle ORM → PostgreSQL
```

**設計原則**
- JSON は使わない。htmx によるHTML断片の受け渡しで CRUD を行う
- API ルートは AstroContainer でコンポーネントを `renderToString` して返す
- 1 機能 = 1 config（Column[] + EntityConfig）を定義するだけで、汎用コンポーネントが UI を自動生成

---

## 開発部品一覧

### コンポーネント

| コンポーネント | 場所 | 役割 |
|---|---|---|
| **CrudTable** | `components/crud/CrudTable.astro` | テーブル骨格。htmx `load` で API を呼び tbody を埋める |
| **CrudRows** | `components/crud/CrudRows.astro` | レコード一覧 + ページネーション。API が返す HTML 断片 |
| **CrudRow** | `components/crud/CrudRow.astro` | 1行の表示行（編集・削除ボタン付き） |
| **CrudEditRow** | `components/crud/CrudEditRow.astro` | インライン編集行（Cancel/Save 付き） |
| **CrudForm** | `components/crud/CrudForm.astro` | 新規登録フォーム。Column[] から入力欄を自動生成 |
| **CrudToolbar** | `components/crud/CrudToolbar.astro` | 一括操作バー（コピー, 削除, エクスポート, 新規追加） |
| **SearchPanel** | `components/crud/SearchPanel.astro` | 検索・フィルタバー（テキスト, 日付, セレクト） |
| **HeaderBodyForm** | `components/header-body/HeaderBodyForm.astro` | ヘッダー＋明細行の登録/編集フォーム |
| **HeaderBodyLineRow** | `components/header-body/HeaderBodyLineRow.astro` | 明細1行（品目選択 + 数量 + 削除） |
| **HeaderBodyListRows** | `components/header-body/HeaderBodyListRows.astro` | 親エンティティの一覧行 + ページネーション |
| **Typeahead** | `components/crud/Typeahead.astro` | ドロップダウン検索（他エンティティ参照用） |

### 型定義 (`components/crud/types.ts`)

| 型 | 説明 |
|---|---|
| **Column** | カラム定義の union 型。`key`, `label`, `type` でフォームとテーブルの振る舞いを制御 |
| **EntityConfig** | エンティティ全体の設定（検索, URL, ID体系, Alpine.js 連携など） |
| **HeaderBodyConfig** | header-body 形式の EntityConfig 拡張。`headerColumns` + `children[]` |
| **TypeaheadConfig** | Typeahead の検索対象・表示設定 |
| **SearchField** | 検索バーの各フィールド定義（text / date / select） |

### カラム type 一覧

| type | 用途 | フォーム | テーブル |
|---|---|---|---|
| `text`（デフォルト） | テキスト入力 | `<input type="text">` | テキスト表示 |
| `number` | 数値入力 | `<input type="number">` | `format: true` で桁区切り表示 |
| `date` | 日付入力 | `<input type="date">` | 日付表示 |
| `select` | プルダウン | `<select>` + `options[]` | 選択値の表示 |
| `barcode` | バーコード | テキスト入力 + プレビュー | バーコード画像 |
| `computed` | 計算フィールド | Alpine.js `expression` で自動計算 | 計算結果を表示 |
| `itemCode` | 品目選択 | Typeahead コンポーネント | 品目コード表示 |
| `readonlyLookup` | 参照表示 | 読み取り専用 | 関連データ表示 |
| `actions` | 操作ボタン | — | 編集・削除ボタン |
| `deleteAction` | 削除ボタン | — | 行削除ボタン（header-body用） |

### Feature コア

| クラス | 場所 | 役割 |
|---|---|---|
| **GenericQuery** | `features/core/generic-query.ts` | 読み取り操作の雛形。Zod パース → DB クエリ → レスポンス |
| **GenericCommand** | `features/core/generic-command.ts` | 書き込み操作の雛形。Zod パース → バリデーション → Mapper → DB 実行 |

### スタイル

| エクスポート | 場所 | 用途 |
|---|---|---|
| `button({ intent })` | `styles/common.ts` | ボタン（primary / secondary / danger） |
| `input({ size })` | `styles/common.ts` | 入力フィールド（default / sm） |
| `thCell`, `tdCell`, `row` | `styles/common.ts` | テーブルセル・行 |
| `pageContainer`, `pageTitle` | `styles/common.ts` | ページレイアウト |
| `card`, `cardTitle` | `styles/common.ts` | カード |
| `errorText` | `styles/common.ts` | エラー表示 |

---

## 例1: ユーザー管理画面（単純CRUD）

### ゴール

| フィールド | 型 | 必須 |
|---|---|---|
| ユーザーコード | text | Yes |
| 氏名 | text | Yes |
| メールアドレス | text | No |
| 部署 | text | No |

検索: コード・氏名のテキスト検索 + 部署フィルタ

### 必要なファイル一覧

```
src/
├── db/schema.ts                          # ← テーブル定義を追加
├── lib/validation.ts                     # ← Zod スキーマを追加
├── features/ユーザー/
│   ├── config.ts                         # カラム定義 + EntityConfig
│   ├── index.ts                          # 公開エクスポート
│   ├── ユーザーResponse.ts               # レスポンス型
│   ├── query/ユーザー一覧Query.ts         # 一覧取得クエリ
│   ├── create/
│   │   ├── ユーザーCreateArgs.ts          # DB 投入用の型
│   │   ├── ユーザーCreateCommand.ts       # 登録コマンド
│   │   ├── ユーザーCreateValidate.ts      # カスタムバリデーション
│   │   └── ユーザーCreateMapper.ts        # 入力 → Args 変換
│   ├── update/
│   │   ├── ユーザーUpdateArgs.ts
│   │   ├── ユーザーUpdateCommand.ts
│   │   ├── ユーザーUpdateMapper.ts
│   │   └── ユーザーUpdateValidate.ts
│   └── delete/
│       ├── ユーザーDeleteCommand.ts        # 単一削除
│       └── ユーザーBulkDeleteCommand.ts    # 一括削除
├── pages/
│   ├── ユーザー.astro                    # 一覧ページ
│   └── api/ユーザー/
│       ├── index.ts                      # GET(一覧) / POST(登録) / DELETE(一括削除)
│       └── [id].ts                       # GET(編集行) / PUT(更新) / DELETE(単一削除)
```

### Step 1: DB スキーマ定義

**`src/db/schema.ts`** に追加:

```typescript
/** ユーザーテーブル */
export const ユーザーテーブル = pgTable("ユーザー", {
  id: serial("id").primaryKey(),
  コード: varchar("コード", { length: 50 }).notNull(),
  名称: varchar("名称", { length: 200 }).notNull(),
  メール: varchar("メール", { length: 200 }),
  部署: varchar("部署", { length: 100 }),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export type ユーザー = typeof ユーザーテーブル.$inferSelect;
export type 新規ユーザー = typeof ユーザーテーブル.$inferInsert;
```

DB に反映:

```bash
bunx drizzle-kit push
```

### Step 2: Zod バリデーション

**`src/lib/validation.ts`** に追加:

```typescript
// ─── ユーザー ─────────────────────────────────

export const ユーザー作成Schema = z.object({
  コード: z.string().min(1, "ユーザーコードは必須です"),
  名称: z.string().min(1, "氏名は必須です"),
  メール: z.string().optional(),
  部署: z.string().optional(),
});

export type ユーザー作成入力 = z.infer<typeof ユーザー作成Schema>;

export const ユーザー更新Schema = ユーザー作成Schema.extend({
  id: z.coerce.number(),
});

export type ユーザー更新入力 = z.infer<typeof ユーザー更新Schema>;

export const ユーザー一覧Schema = z.object({
  page: z.coerce.number().default(1),
  size: z.coerce.number().default(20),
  q: z.string().optional(),
  部署: z.string().optional(),
});

export type ユーザー一覧入力 = z.infer<typeof ユーザー一覧Schema>;
```

### Step 3: Feature config

**`src/features/ユーザー/config.ts`**:

```typescript
import type { Column, EntityConfig } from "../../components/crud/types";

export const ユーザーカラム: Column[] = [
  { key: "コード", label: "ユーザーコード", required: true, placeholder: "例: USR-001" },
  { key: "名称", label: "氏名", required: true, placeholder: "例: 山田太郎" },
  { key: "メール", label: "メールアドレス", placeholder: "例: yamada@example.com" },
  { key: "部署", label: "部署", placeholder: "例: 開発部" },
  { key: "_actions", label: "操作", type: "actions", width: "32" },
];

export const ユーザーエンティティ: EntityConfig = {
  searchFields: [
    {
      searchType: "text",
      param: "q",
      label: "検索",
      placeholder: "コード・氏名で検索…",
      flexClass: "flex-1 min-w-[12.5rem]",
      dbColumns: ["コード", "名称"],
    },
    {
      searchType: "text",
      param: "部署",
      label: "部署",
      placeholder: "部署",
      flexClass: "min-w-[10rem]",
      dbColumns: ["部署"],
    },
  ],
  tableName: "ユーザー",
  idPrefix: "user",
  baseUrl: "/api/ユーザー",
  bodyTargetId: "users-body",
  paginationId: "users-pagination",
  displayNameKey: "名称",
  deleteConfirmTemplate: "「{名称}」を削除しますか？",
  formTitle: "新規ユーザー登録",
  formAfterRequest:
    "if($event.detail.successful && $event.detail.elt === $el) { $el.reset(); open = false }",
  emptyMessage: "ユーザーがいません",
};
```

### Step 4: Feature 実装ファイル群

**`src/features/ユーザー/ユーザーResponse.ts`**:
```typescript
import type { ユーザー } from "../../db/schema";

export type ユーザーResponse = ユーザー;
```

**`src/features/ユーザー/create/ユーザーCreateArgs.ts`**:
```typescript
export type ユーザーCreateArgs = {
  コード: string;
  名称: string;
  メール: string | null;
  部署: string | null;
};
```

**`src/features/ユーザー/create/ユーザーCreateMapper.ts`**:
```typescript
import type { ユーザー作成入力 } from "../../../lib/validation";
import type { ユーザーCreateArgs } from "./ユーザーCreateArgs";

export const ユーザーCreateMapper: (input: ユーザー作成入力) => ユーザーCreateArgs = (input) => ({
  コード: input.コード,
  名称: input.名称,
  メール: input.メール ?? null,
  部署: input.部署 ?? null,
});
```

**`src/features/ユーザー/create/ユーザーCreateValidate.ts`**:
```typescript
import type { ユーザー作成入力 } from "../../../lib/validation";

export const ユーザーCreateValidate: (input: ユーザー作成入力) => Promise<void> = async (_input) => {
  // 必要に応じてコード重複チェック等を追加
};
```

**`src/features/ユーザー/create/ユーザーCreateCommand.ts`**:
```typescript
import { GenericCommand } from "../../core/generic-command";
import { ユーザー作成Schema, type ユーザー作成入力 } from "../../../lib/validation";
import type { ユーザーCreateArgs } from "./ユーザーCreateArgs";
import { ユーザーCreateValidate } from "./ユーザーCreateValidate";
import { ユーザーCreateMapper } from "./ユーザーCreateMapper";
import { db } from "../../../db";
import { ユーザーテーブル } from "../../../db/schema";

export const ユーザーCreateCommand = new GenericCommand<ユーザー作成入力, ユーザーCreateArgs, void>({
  schema: ユーザー作成Schema,
  validate: ユーザーCreateValidate,
  mapper: ユーザーCreateMapper,
  command: async (args) => {
    await db.insert(ユーザーテーブル).values(args);
  },
});
```

**`src/features/ユーザー/query/ユーザー一覧Query.ts`**:
```typescript
import { GenericQuery } from "../../core/generic-query";
import { ユーザー一覧Schema, type ユーザー一覧入力 } from "../../../lib/validation";
import { db } from "../../../db";
import { ユーザーテーブル } from "../../../db/schema";
import { and, count, desc, ilike, or } from "drizzle-orm";
import type { ユーザーResponse } from "../ユーザーResponse";

export type ユーザー一覧Result = {
  records: ユーザーResponse[];
  currentPage: number;
  totalPages: number;
  pageSize: number;
  extraParams: Record<string, string>;
};

const PAGE_SIZES = [20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;

export const ユーザー一覧Query = new GenericQuery<ユーザー一覧入力, ユーザー一覧Result>({
  schema: ユーザー一覧Schema,
  query: async (input) => {
    const size = PAGE_SIZES.includes(input.size as any) ? input.size : DEFAULT_PAGE_SIZE;

    const conditions = [];
    if (input.q) {
      conditions.push(
        or(ilike(ユーザーテーブル.コード, `%${input.q}%`), ilike(ユーザーテーブル.名称, `%${input.q}%`)),
      );
    }
    if (input.部署) {
      conditions.push(ilike(ユーザーテーブル.部署, `%${input.部署}%`));
    }
    const searchFilter = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(ユーザーテーブル).where(searchFilter);
    const totalPages = Math.max(1, Math.ceil(total / size));
    const currentPage = Math.min(Math.max(1, input.page), totalPages);

    const records = await db
      .select()
      .from(ユーザーテーブル)
      .where(searchFilter)
      .orderBy(desc(ユーザーテーブル.id))
      .limit(size)
      .offset((currentPage - 1) * size);

    const extraParams: Record<string, string> = {};
    if (input.q) extraParams.q = input.q;
    if (input.部署) extraParams["部署"] = input.部署;

    return { records, currentPage, totalPages, pageSize: size, extraParams };
  },
});
```

**更新・削除** も同じパターンで作成（品目の対応ファイルをコピーして型名・テーブル名を差し替え）。

**`src/features/ユーザー/index.ts`**:
```typescript
export { ユーザーカラム, ユーザーエンティティ } from "./config";
export { ユーザー一覧Query } from "./query/ユーザー一覧Query";
export { ユーザーCreateCommand } from "./create/ユーザーCreateCommand";
export { ユーザーBulkDeleteCommand } from "./delete/ユーザーBulkDeleteCommand";
export type { ユーザーResponse } from "./ユーザーResponse";
```

### Step 5: API ルート

**`src/pages/api/ユーザー/index.ts`**:
```typescript
import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { ユーザー一覧Query, ユーザーCreateCommand, ユーザーBulkDeleteCommand } from "../../../features/ユーザー";
import { ユーザーカラム, ユーザーエンティティ } from "../../../features/ユーザー";
// @ts-ignore
import CrudRows from "../../../components/crud/CrudRows.astro";
import { errorText } from "../../../styles/common";

const container = await AstroContainer.create();

/** GET — 一覧 */
export const GET: APIRoute = async ({ url }) => {
  const result = await ユーザー一覧Query.execute({
    page: Number(url.searchParams.get("page")) || 1,
    size: Number(url.searchParams.get("size")) || 20,
    q: url.searchParams.get("q") || undefined,
    部署: url.searchParams.get("部署") || undefined,
  });

  const html = await container.renderToString(CrudRows, {
    props: {
      records: result.records,
      columns: ユーザーカラム,
      entity: ユーザーエンティティ,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      pageSize: result.pageSize,
      extraParams: result.extraParams,
    },
  });
  return new Response(html, { headers: { "Content-Type": "text/html" } });
};

/** POST — 登録 */
export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();

  try {
    await ユーザーCreateCommand.execute({
      コード: form.get("コード") as string,
      名称: form.get("名称") as string,
      メール: (form.get("メール") as string) || undefined,
      部署: (form.get("部署") as string) || undefined,
    });
  } catch (e: any) {
    return new Response(`<p class="${errorText}">${e.message}</p>`, {
      status: 422,
      headers: { "Content-Type": "text/html" },
    });
  }

  const url = new URL(request.url);
  const size = Number(url.searchParams.get("size")) || 20;
  const result = await ユーザー一覧Query.execute({ page: 1, size });

  const html = await container.renderToString(CrudRows, {
    props: {
      records: result.records,
      columns: ユーザーカラム,
      entity: ユーザーエンティティ,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      pageSize: result.pageSize,
      extraParams: result.extraParams,
    },
  });
  const resp = new Response(html, { headers: { "Content-Type": "text/html" } });
  resp.headers.set("HX-Trigger", JSON.stringify({ "show-toast": encodeURIComponent("登録しました") }));
  return resp;
};

/** DELETE — 一括削除 */
export const DELETE: APIRoute = async ({ request }) => {
  const { ids } = (await request.json()) as { ids: string[] };
  const numIds = ids.map(Number).filter((n) => !isNaN(n));
  if (numIds.length === 0) return new Response("", { status: 400 });
  await ユーザーBulkDeleteCommand.execute({ ids: numIds });
  return new Response("", { status: 200 });
};
```

**`src/pages/api/ユーザー/[id].ts`** も同パターン（品目の `[id].ts` をコピーして差し替え）。

### Step 6: ページ

**`src/pages/ユーザー.astro`**:
```astro
---
import Layout from "../layouts/Layout.astro";
import Nav from "../components/Nav.astro";
import { pageContainer, pageTitle } from "../styles/common";
import CrudToolbar from "../components/crud/CrudToolbar.astro";
import CrudTable from "../components/crud/CrudTable.astro";
import CrudForm from "../components/crud/CrudForm.astro";
import SearchPanel from "../components/crud/SearchPanel.astro";
import { ユーザーカラム, ユーザーエンティティ } from "../features/ユーザー";
---

<Layout>
  <main class={pageContainer}>
    <Nav current="users" />
    <h1 class={pageTitle}>ユーザー管理</h1>

    <SearchPanel entity={ユーザーエンティティ} />

    <div x-data="{ open: false }">
      <CrudToolbar
        baseUrl="/api/ユーザー"
        bodyTargetId="users-body"
        tableId="users-table"
        searchContainerId="users-search"
      />
      <CrudForm columns={ユーザーカラム} entity={ユーザーエンティティ} />
    </div>

    <CrudTable
      columns={ユーザーカラム}
      bodyId="users-body"
      baseUrl="/api/ユーザー"
      paginationId="users-pagination"
      tableId="users-table"
    />
  </main>
</Layout>
```

### データフロー図

```
[ユーザー.astro]
    │
    ├── SearchPanel ─── htmx GET /api/ユーザー?q=...&department=...
    │                        ↓
    ├── CrudToolbar ─── 一括削除 → DELETE /api/ユーザー
    │                   エクスポート → GET /api/ユーザー/export
    │
    ├── CrudForm ────── htmx POST /api/ユーザー
    │                        ↓
    │                   ユーザーCreateCommand.execute()
    │                        ↓
    │                   CrudRows (HTML断片) を tbody に swap
    │
    └── CrudTable ───── htmx GET /api/ユーザー (load時)
                             ↓
                        ユーザー一覧Query.execute()
                             ↓
                        CrudRows → CrudRow × N + CrudPagination
                             │
                             ├── 編集ボタン → GET /api/ユーザー/[id] → CrudEditRow
                             │                  PUT /api/ユーザー/[id] → CrudRow
                             └── 削除ボタン → DELETE /api/ユーザー/[id] → 行削除
```

---

## 例2: 注文管理画面（header-body形式）

### ゴール

注文ヘッダー + 注文明細の親子関係を持つ画面。

**注文ヘッダー:**

| フィールド | 型 | 必須 |
|---|---|---|
| 注文番号 | text | Yes |
| 注文日 | date | Yes |
| 顧客名 | text | Yes |

**注文明細（子テーブル）:**

| フィールド | 型 | 必須 |
|---|---|---|
| 品目 | itemCode (Typeahead) | Yes |
| 品目名 | readonlyLookup | — |
| 数量 | number | Yes |
| 単位 | select | Yes |

一覧は注文ヘッダーのみ表示。詳細ページで明細の登録・編集。

### 必要なファイル一覧

```
src/
├── db/schema.ts                            # ← テーブル定義を追加 (注文 + 注文明細)
├── lib/validation.ts                       # ← Zod スキーマを追加
├── features/注文/
│   ├── config.ts                           # HeaderBodyConfig 定義
│   ├── index.ts                            # 公開エクスポート
│   ├── 注文Response.ts                     # レスポンス型
│   ├── query/注文一覧Query.ts              # ヘッダー一覧クエリ
│   ├── create/
│   │   ├── 注文CreateArgs.ts
│   │   ├── 注文CreateCommand.ts            # ヘッダー＋明細を一括登録
│   │   ├── 注文CreateValidate.ts
│   │   └── 注文CreateMapper.ts
│   ├── update/
│   │   ├── 注文UpdateArgs.ts
│   │   ├── 注文UpdateCommand.ts            # ヘッダー更新 + 明細差し替え
│   │   ├── 注文UpdateValidate.ts
│   │   └── 注文UpdateMapper.ts
│   └── delete/
│       ├── 注文DeleteCommand.ts
│       └── 注文BulkDeleteCommand.ts
├── pages/
│   ├── 注文.astro                          # 一覧ページ
│   ├── 注文/
│   │   ├── new.astro                       # 新規登録ページ
│   │   └── [id].astro                      # 編集ページ
│   └── api/注文/
│       ├── index.ts                        # GET(一覧) / POST(登録) / DELETE(一括削除)
│       ├── [id].ts                         # PUT(更新) / DELETE(単一削除)
│       └── line-row.ts                     # GET — 空の明細行HTMLを返す
```

### Step 1: DB スキーマ定義

**`src/db/schema.ts`** に追加:

```typescript
/** 注文テーブル (ヘッダー) */
export const 注文テーブル = pgTable("注文", {
  id: serial("id").primaryKey(),
  コード: varchar("コード", { length: 50 }).notNull(),
  日付: date("日付").notNull(),
  顧客名: varchar("顧客名", { length: 200 }).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export type 注文 = typeof 注文テーブル.$inferSelect;
export type 新規注文 = typeof 注文テーブル.$inferInsert;

/** 注文明細テーブル (ボディ) */
export const 注文明細テーブル = pgTable("注文明細", {
  id: serial("id").primaryKey(),
  注文ID: integer("注文ID")
    .notNull()
    .references(() => 注文テーブル.id, { onDelete: "cascade" }),
  品目ID: integer("品目ID")
    .notNull()
    .references(() => 品目テーブル.id),
  数量: numeric("数量", { precision: 12, scale: 4 }).notNull(),
  単位: varchar("単位", { length: 20 }).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export type 注文明細 = typeof 注文明細テーブル.$inferSelect;
export type 新規注文明細 = typeof 注文明細テーブル.$inferInsert;
```

### Step 2: Zod バリデーション

**`src/lib/validation.ts`** に追加:

```typescript
// ─── 注文 ─────────────────────────────────────

export const 注文明細Schema = z.object({
  品目ID: z.coerce.number().positive("品目は必須です"),
  数量: z.string().min(1, "数量は必須です"),
  単位: z.string().min(1, "単位は必須です"),
});

export const 注文作成Schema = z.object({
  コード: z.string().min(1, "注文番号は必須です"),
  日付: z.string().min(1, "注文日は必須です"),
  顧客名: z.string().min(1, "顧客名は必須です"),
  明細: z.array(注文明細Schema),
});

export type 注文作成入力 = z.infer<typeof 注文作成Schema>;

export const 注文更新Schema = 注文作成Schema.extend({
  id: z.coerce.number(),
});

export type 注文更新入力 = z.infer<typeof 注文更新Schema>;

export const 注文一覧Schema = z.object({
  page: z.coerce.number().default(1),
  size: z.coerce.number().default(20),
  q: z.string().optional(),
});

export type 注文一覧入力 = z.infer<typeof 注文一覧Schema>;
```

### Step 3: Feature config（HeaderBodyConfig）

**`src/features/注文/config.ts`**:

```typescript
import type { HeaderBodyConfig } from "../../components/crud/types";

const unitOptions = [
  { value: "pcs", label: "個" },
  { value: "kg", label: "kg" },
  { value: "box", label: "箱" },
  { value: "set", label: "セット" },
];

export const 注文ヘッダーボディ: HeaderBodyConfig = {
  type: "header-body",
  tableName: "注文",
  idPrefix: "order",
  baseUrl: "/api/注文",
  bodyTargetId: "orders-body",
  paginationId: "orders-pagination",
  displayNameKey: "コード",
  deleteConfirmTemplate: "注文「{コード}」を削除しますか？",
  formTitle: "新規注文登録",
  emptyMessage: "注文がありません",

  // ヘッダー部のカラム定義（一覧テーブルのカラムにもなる）
  headerColumns: [
    { key: "コード", label: "注文番号", required: true, placeholder: "例: ORD-001" },
    { key: "日付", label: "注文日", type: "date", required: true },
    { key: "顧客名", label: "顧客名", required: true, placeholder: "例: 山田商事" },
  ],

  // 明細セクション（1つの子テーブル）
  children: [
    {
      tableName: "注文明細",
      sectionLabel: "注文明細",
      // discriminator は不要（子テーブルが1種類のみ）
      columns: [
        { key: "品目コード", label: "品目コード", type: "itemCode" },
        { key: "品目名", label: "品目名", type: "readonlyLookup" },
        { key: "数量", label: "数量", type: "number", min: 0, placeholder: "0" },
        {
          key: "単位",
          label: "単位",
          type: "select",
          options: unitOptions,
          defaultValue: "pcs",
        },
        { key: "_delete", label: "", type: "deleteAction", width: "3rem" },
      ],
    },
  ],
};
```

**ポイント**: 単純CRUDとの違い

| 単純CRUD (EntityConfig) | header-body (HeaderBodyConfig) |
|---|---|
| `columns: Column[]` をトップレベルに定義 | `headerColumns` + `children[].columns` に分離 |
| CrudTable / CrudForm を使用 | HeaderBodyForm / HeaderBodyLineRow を使用 |
| 1ページで一覧＋登録 | 一覧ページ + 詳細ページ（`/new`, `/[id]`）に分離 |
| API は CrudRows を返す | API は ヘッダー一覧 or リダイレクト |

### Step 4: 一覧ページ

**`src/pages/注文.astro`**:

```astro
---
import Layout from "../layouts/Layout.astro";
import Nav from "../components/Nav.astro";
import { 注文ヘッダーボディ } from "../features/注文/config";
import { pageContainer, pageTitle, button, thCell } from "../styles/common";

const config = 注文ヘッダーボディ;
const listUrl = config.baseUrl.replace(/^\/api/, "");
const toolbar = "flex justify-end mb-4";
const emptyRow = "text-center py-8 text-outline text-sm";
const tableWrap = "overflow-x-auto rounded-xl bg-white";
---

<Layout>
  <main class={pageContainer}>
    <Nav current="orders" />
    <h1 class={pageTitle}>注文管理</h1>

    <div class={toolbar}>
      <a href={`${listUrl}/new`} class={button({ intent: "primary" })}>
        + {config.formTitle}
      </a>
    </div>

    <div class={tableWrap}>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            {config.headerColumns
              .filter((c) => c.type !== "actions")
              .map((col) => <th class={thCell}>{col.label}</th>)}
            <th class={thCell} style="width: 10rem;">操作</th>
          </tr>
        </thead>
        <tbody
          id={config.bodyTargetId}
          hx-get={config.baseUrl}
          hx-trigger="load"
          hx-swap="innerHTML"
        >
          <tr>
            <td colspan={config.headerColumns.length + 1} class={emptyRow}>
              読み込み中…
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div id={config.paginationId}></div>
  </main>
</Layout>
```

### Step 5: 新規登録ページ / 編集ページ

**`src/pages/注文/new.astro`**:

```astro
---
import Layout from "../../layouts/Layout.astro";
import Nav from "../../components/Nav.astro";
import HeaderBodyForm from "../../components/header-body/HeaderBodyForm.astro";
import { 注文ヘッダーボディ } from "../../features/注文/config";
import { pageContainer, pageTitle } from "../../styles/common";
---

<Layout>
  <main class={pageContainer}>
    <Nav current="orders" />
    <h1 class={pageTitle}>注文登録</h1>
    <HeaderBodyForm config={注文ヘッダーボディ} mode="create" />
  </main>
</Layout>
```

**`src/pages/注文/[id].astro`**:

```astro
---
import Layout from "../../layouts/Layout.astro";
import Nav from "../../components/Nav.astro";
import HeaderBodyForm from "../../components/header-body/HeaderBodyForm.astro";
import { 注文ヘッダーボディ } from "../../features/注文/config";
import { pageContainer, pageTitle } from "../../styles/common";
import { db } from "../../db";
import { 注文テーブル, 注文明細テーブル, 品目テーブル } from "../../db/schema";
import { eq } from "drizzle-orm";

const config = 注文ヘッダーボディ;
const id = Number(Astro.params.id);
if (!id) return Astro.redirect("/注文");

const showSavedToast = Astro.url.searchParams.has("saved");

const [order] = await db.select().from(注文テーブル).where(eq(注文テーブル.id, id)).limit(1);
if (!order) return Astro.redirect("/注文");

// 明細を品目情報と JOIN で取得
const lines = await db
  .select({
    id: 注文明細テーブル.id,
    品目ID: 注文明細テーブル.品目ID,
    数量: 注文明細テーブル.数量,
    単位: 注文明細テーブル.単位,
    品目コード: 品目テーブル.コード,
    品目名: 品目テーブル.名称,
  })
  .from(注文明細テーブル)
  .leftJoin(品目テーブル, eq(注文明細テーブル.品目ID, 品目テーブル.id))
  .where(eq(注文明細テーブル.注文ID, id));

// childrenData を構築
const childrenData = config.children.map((child) => {
  const disc = child.discriminator;
  const filtered = disc
    ? lines.filter((l) => (l as any)[disc.column] === disc.value)
    : lines;
  return {
    records: filtered.map((l) => ({
      品目ID: l.品目ID,
      品目コード: l.品目コード || "",
      品目名: l.品目名|| "",
      数量: l.数量,
      単位: l.単位,
    })),
  };
});

const headerValues = {
  コード: order.コード,
  日付: order.日付,
  顧客名: order.顧客名,
};
---

<Layout>
  <main class={pageContainer}>
    <Nav current="orders" />
    <h1 class={pageTitle}>注文編集</h1>
    <HeaderBodyForm
      config={config}
      mode="edit"
      recordId={id}
      headerValues={headerValues}
      childrenData={childrenData}
    />
  </main>
</Layout>

{showSavedToast && <meta data-show-saved />}

<script>
  document.addEventListener("DOMContentLoaded", () => {
    const flag = document.querySelector("meta[data-show-saved]");
    if (!flag) return;
    flag.remove();
    window.dispatchEvent(
      new CustomEvent("show-toast", { detail: { value: "保存しました" } }),
    );
    const url = new URL(window.location.href);
    url.searchParams.delete("saved");
    history.replaceState(null, "", url.pathname);
  });
</script>
```

### Step 6: API ルート

**`src/pages/api/注文/line-row.ts`** — 空の明細行 HTML を返す（「+ 行追加」ボタン用）:

```typescript
import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
// @ts-ignore
import HeaderBodyLineRow from "../../../components/header-body/HeaderBodyLineRow.astro";
import { 注文ヘッダーボディ } from "../../../features/注文/config";

const container = await AstroContainer.create();

export const GET: APIRoute = async ({ url }) => {
  const section = Number(url.searchParams.get("section") ?? "0");
  const child = 注文ヘッダーボディ.children[section];
  if (!child) return new Response("", { status: 400 });

  const rowKey = `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const html = await container.renderToString(HeaderBodyLineRow, {
    props: {
      columns: child.columns,
      record: {},
      rowKey,
      sectionIndex: section,
      config: 注文ヘッダーボディ,
    },
  });
  return new Response(html, { headers: { "Content-Type": "text/html" } });
};
```

### データフロー図

```
[注文.astro]  一覧ページ
    │
    ├── ヘッダーテーブル ── htmx GET /api/注文 → HeaderBodyListRows
    │                      (注文番号, 注文日, 顧客名, 操作)
    │
    └── 「+ 新規注文登録」ボタン → /注文/new へ遷移

[注文/new.astro]  新規登録ページ
    │
    └── HeaderBodyForm (mode="create")
         ├── ヘッダー入力欄 (注文番号, 注文日, 顧客名)
         │
         └── 注文明細セクション
              ├── 明細行 × N (HeaderBodyLineRow)
              │     ├── 品目コード (Typeahead → /api/品目/search)
              │     ├── 品目名 (readonlyLookup, 自動表示)
              │     ├── 数量, 単位
              │     └── 削除ボタン (行をDOMから除去)
              │
              └── 「+ 行追加」 → GET /api/注文/line-row?section=0
                                  → 空の HeaderBodyLineRow を append

         送信 → POST /api/注文
              → 注文CreateCommand (ヘッダー INSERT → 明細 INSERT)
              → リダイレクト /注文/[id]?saved

[注文/[id].astro]  編集ページ
    │
    └── HeaderBodyForm (mode="edit")
         送信 → PUT /api/注文/[id]
              → 注文UpdateCommand (ヘッダー UPDATE + 明細 DELETE & INSERT)
              → リダイレクト /注文/[id]?saved
```

---

## 開発チェックリスト

新しい機能を追加する際の手順:

### 単純CRUD の場合

**実装:**

- [ ] `src/db/schema.ts` にテーブル定義を追加
- [ ] `bunx drizzle-kit push` で DB に反映
- [ ] `src/lib/validation.ts` に Zod スキーマを追加（作成・更新・一覧）
- [ ] `src/features/XXX/config.ts` に `Column[]` と `EntityConfig` を定義
- [ ] `src/features/XXX/` に Query / Command ファイル群を作成
- [ ] `src/features/XXX/index.ts` でエクスポート
- [ ] `src/pages/api/XXX/index.ts` (GET / POST / DELETE)
- [ ] `src/pages/api/XXX/[id].ts` (GET / PUT / DELETE)
- [ ] `src/pages/XXX.astro` でページ作成
- [ ] `src/components/Nav.astro` にナビゲーションリンクを追加

**品質ゲート:**

- [ ] `bun fmt` でフォーマット
- [ ] 型チェック通過（`bunx --bun astro check` or `bunx tsc --noEmit`）
- [ ] 命名規約の準拠確認（日本語/英語の混在がないこと）
- [ ] バリデーション責務の確認（`command` に業務ロジックが混入していないこと）
- [ ] API レスポンス契約の準拠確認（ステータスコード、トースト通知）
- [ ] 画面主要フロー確認: 登録 → 一覧表示 → 検索 → 編集 → 削除

### header-body の場合

**実装:**

- [ ] `src/db/schema.ts` にヘッダー + 明細テーブル定義を追加
- [ ] `bunx drizzle-kit push` で DB に反映
- [ ] `src/lib/validation.ts` に Zod スキーマを追加（明細含む）
- [ ] `src/features/XXX/config.ts` に `HeaderBodyConfig` を定義
- [ ] `src/features/XXX/` に Query / Command ファイル群を作成
- [ ] `src/features/XXX/index.ts` でエクスポート
- [ ] `src/pages/api/XXX/index.ts` (GET一覧 / POST登録)
- [ ] `src/pages/api/XXX/[id].ts` (PUT更新 / DELETE削除)
- [ ] `src/pages/api/XXX/line-row.ts` (GET空行HTML)
- [ ] `src/pages/XXX.astro` で一覧ページ作成
- [ ] `src/pages/XXX/new.astro` で新規登録ページ作成
- [ ] `src/pages/XXX/[id].astro` で編集ページ作成
- [ ] `src/components/Nav.astro` にナビゲーションリンクを追加

**品質ゲート:**

- [ ] `bun fmt` でフォーマット
- [ ] 型チェック通過（`bunx --bun astro check` or `bunx tsc --noEmit`）
- [ ] 命名規約の準拠確認（日本語/英語の混在がないこと）
- [ ] バリデーション責務の確認（`command` に業務ロジックが混入していないこと）
- [ ] API レスポンス契約の準拠確認（ステータスコード、トースト通知）
- [ ] 明細テーブル FK に `onDelete: "cascade"` が設定されていること
- [ ] 画面主要フロー確認: 登録 → 一覧表示 → 編集 → 明細行追加/削除 → 削除
- [ ] 更新戦略の確認（DELETE & INSERT が適切か、差分更新が必要か）

### レビュー観点

PR レビュー時は以下を重点確認する:

- **責務逸脱**: API ルートに業務ロジックが混入していないか、`command` にバリデーションが入っていないか
- **規約逸脱**: 命名規約、API レスポンス契約、バリデーション責務が守られているか
- **セキュリティ**: ユーザー入力の Zod バリデーション漏れ、SQL インジェクション経路がないか
