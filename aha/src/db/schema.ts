import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  date,
} from "drizzle-orm/pg-core";

/** 品目テーブル */
export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  category: varchar("category", { length: 100 }),
  price: integer("price").notNull().default(0),
  barcode: varchar("barcode", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;

/** 取引テーブル */
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  transactionTypeId: integer("transaction_type_id")
    .notNull()
    .references(() => transactionTypes.id),
  itemId: integer("item_id")
    .notNull()
    .references(() => items.id),
  unitPrice: integer("unit_price").notNull().default(0),
  quantity: integer("quantity").notNull().default(1),
  amount: integer("amount").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

/** 取引区分テーブル */
export const transactionTypes = pgTable("transaction_types", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  /** 受払係数: -1, 0, 1 */
  coefficient: integer("coefficient").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type TransactionType = typeof transactionTypes.$inferSelect;
export type NewTransactionType = typeof transactionTypes.$inferInsert;
