import { z } from "zod";

// ─── 品目 ─────────────────────────────────────

export const 品目作成Schema = z.object({
  コード: z.string().min(1, "品目コードは必須です"),
  名称: z.string().min(1, "品目名は必須です"),
  カテゴリ: z.string().optional(),
  単価: z.coerce.number().min(0).default(0),
  バーコード: z.string().optional(),
});

export type 品目作成入力 = z.infer<typeof 品目作成Schema>;

export const 品目更新Schema = 品目作成Schema.extend({
  id: z.coerce.number(),
});

export type 品目更新入力 = z.infer<typeof 品目更新Schema>;

export const 品目一覧Schema = z.object({
  page: z.coerce.number().default(1),
  size: z.coerce.number().default(20),
  q: z.string().optional(),
  カテゴリ: z.string().optional(),
});

export type 品目一覧入力 = z.infer<typeof 品目一覧Schema>;

// ─── 取引区分 ─────────────────────────────────

export const 取引区分作成Schema = z.object({
  コード: z.string().min(1, "取引区分コードは必須です"),
  名称: z.string().min(1, "取引区分名称は必須です"),
  係数: z.coerce
    .number()
    .refine(
      (v) => [-1, 0, 1].includes(v),
      "受払係数は -1, 0, 1 のいずれかです",
    ),
});

export type 取引区分作成入力 = z.infer<typeof 取引区分作成Schema>;

export const 取引区分更新Schema = 取引区分作成Schema.extend({
  id: z.coerce.number(),
});

export type 取引区分更新入力 = z.infer<typeof 取引区分更新Schema>;

export const 取引区分一覧Schema = z.object({
  page: z.coerce.number().default(1),
  size: z.coerce.number().default(20),
});

export type 取引区分一覧入力 = z.infer<typeof 取引区分一覧Schema>;

// ─── 取引 ─────────────────────────────────────

export const 取引作成Schema = z.object({
  日付: z.string().min(1, "日付は必須です"),
  取引区分ID: z.coerce.number().positive("取引区分を選択してください"),
  品目ID: z.coerce.number().positive("品目を選択してください"),
  単価: z.coerce.number().min(0).default(0),
  数量: z.coerce.number().min(1).default(1),
});

export type 取引作成入力 = z.infer<typeof 取引作成Schema>;

export const 取引更新Schema = 取引作成Schema.extend({
  id: z.coerce.number(),
});

export type 取引更新入力 = z.infer<typeof 取引更新Schema>;

export const 取引一覧Schema = z.object({
  page: z.coerce.number().default(1),
  size: z.coerce.number().default(20),
  開始日: z.string().optional(),
  終了日: z.string().optional(),
});

export type 取引一覧入力 = z.infer<typeof 取引一覧Schema>;

// ─── BOM ──────────────────────────────────────

export const BOM明細Schema = z.object({
  区分: z.coerce.number(),
  品目ID: z.coerce.number().positive("品目は必須です"),
  数量: z.string().min(1, "数量は必須です"),
  単位: z.string().min(1, "単位は必須です"),
  参照BOMコード: z.string().nullable().optional(),
  参照BOM版: z.string().nullable().optional(),
});

export const BOM作成Schema = z.object({
  コード: z.string().min(1, "BOMコードは必須です"),
  版: z.string().min(1, "版は必須です"),
  名称: z.string().min(1, "名称は必須です"),
  明細: z.array(BOM明細Schema),
});

export type BOM作成入力 = z.infer<typeof BOM作成Schema>;

export const BOM更新Schema = BOM作成Schema.extend({
  id: z.coerce.number(),
});

export type BOM更新入力 = z.infer<typeof BOM更新Schema>;

export const BOM一覧Schema = z.object({
  page: z.coerce.number().default(1),
  size: z.coerce.number().default(20),
  q: z.string().optional(),
});

export type BOM一覧入力 = z.infer<typeof BOM一覧Schema>;

// ─── 一括削除 ─────────────────────────────────

export const 一括削除Schema = z.object({
  ids: z.array(z.coerce.number()),
});

export type 一括削除入力 = z.infer<typeof 一括削除Schema>;

export const 単一削除Schema = z.object({
  id: z.coerce.number(),
});

export type 単一削除入力 = z.infer<typeof 単一削除Schema>;
