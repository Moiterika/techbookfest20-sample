import {
  pgTable,
  serial,
  varchar,
  integer,
  numeric,
  timestamp,
  date,
  unique,
} from "drizzle-orm/pg-core";

/** 品目テーブル */
export const 品目テーブル = pgTable("品目", {
  id: serial("id").primaryKey(),
  コード: varchar("コード", { length: 50 }).notNull().unique(),
  名称: varchar("名称", { length: 200 }).notNull(),
  カテゴリ: varchar("カテゴリ", { length: 100 }),
  単価: integer("単価").notNull().default(0),
  バーコード: varchar("バーコード", { length: 100 }),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export type 品目 = typeof 品目テーブル.$inferSelect;
export type 新規品目 = typeof 品目テーブル.$inferInsert;

/** 取引テーブル */
export const 取引テーブル = pgTable("取引", {
  id: serial("id").primaryKey(),
  日付: date("日付").notNull(),
  取引区分ID: integer("取引区分ID")
    .notNull()
    .references(() => 取引区分テーブル.id),
  品目ID: integer("品目ID")
    .notNull()
    .references(() => 品目テーブル.id),
  単価: integer("単価").notNull().default(0),
  数量: integer("数量").notNull().default(1),
  金額: integer("金額").notNull().default(0),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export type 取引 = typeof 取引テーブル.$inferSelect;
export type 新規取引 = typeof 取引テーブル.$inferInsert;

/** 取引区分テーブル */
export const 取引区分テーブル = pgTable("取引区分", {
  id: serial("id").primaryKey(),
  コード: varchar("コード", { length: 50 }).notNull().unique(),
  名称: varchar("名称", { length: 200 }).notNull(),
  /** 受払係数: -1, 0, 1 */
  係数: integer("係数").notNull().default(0),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export type 取引区分 = typeof 取引区分テーブル.$inferSelect;
export type 新規取引区分 = typeof 取引区分テーブル.$inferInsert;

/** BOMテーブル (ヘッダー) */
export const BOMテーブル = pgTable(
  "BOM",
  {
    id: serial("id").primaryKey(),
    コード: varchar("コード", { length: 50 }).notNull(),
    版: varchar("版", { length: 20 }).notNull(),
    名称: varchar("名称", { length: 200 }).notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [unique().on(t.コード, t.版)],
);

export type BOM = typeof BOMテーブル.$inferSelect;
export type 新規BOM = typeof BOMテーブル.$inferInsert;

/** BOM明細テーブル (ボディ) */
export const BOM明細テーブル = pgTable("BOM明細", {
  id: serial("id").primaryKey(),
  BOM_ID: integer("BOM_ID")
    .notNull()
    .references(() => BOMテーブル.id, { onDelete: "cascade" }),
  /** 1=投入, 2=製造 */
  区分: integer("区分").notNull(),
  品目ID: integer("品目ID")
    .notNull()
    .references(() => 品目テーブル.id),
  数量: numeric("数量", { precision: 12, scale: 4 }).notNull(),
  単位: varchar("単位", { length: 20 }).notNull(),
  /** 投入行のみ: 参照先BOMコード (任意) */
  参照BOMコード: varchar("参照BOMコード", { length: 50 }),
  /** 投入行のみ: 参照先BOM版 (任意、参照BOMコードが必要) */
  参照BOM版: varchar("参照BOM版", { length: 20 }),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export type BOM明細 = typeof BOM明細テーブル.$inferSelect;
export type 新規BOM明細 = typeof BOM明細テーブル.$inferInsert;
