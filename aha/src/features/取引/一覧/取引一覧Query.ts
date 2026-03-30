import { GenericQuery } from "../../core/generic-query";
import { 取引一覧Schema, type 取引一覧入力 } from "../../../lib/validation";
import { db } from "../../../db";
import { transactions, items } from "../../../db/schema";
import { and, count, desc, eq, gte, lte } from "drizzle-orm";
import type { 取引Response } from "../取引Response";

export type 取引一覧Result = {
  records: 取引Response[];
  currentPage: number;
  totalPages: number;
  pageSize: number;
  extraParams: Record<string, string>;
};

const PAGE_SIZES = [20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;

export const 取引一覧Query = new GenericQuery<取引一覧入力, 取引一覧Result>({
  schema: 取引一覧Schema,
  query: async (input) => {
    const size = PAGE_SIZES.includes(input.size as any)
      ? input.size
      : DEFAULT_PAGE_SIZE;

    const conditions = [];
    if (input.dateFrom) conditions.push(gte(transactions.date, input.dateFrom));
    if (input.dateTo) conditions.push(lte(transactions.date, input.dateTo));
    const dateFilter = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(transactions)
      .where(dateFilter);
    const totalPages = Math.max(1, Math.ceil(total / size));
    const currentPage = Math.min(Math.max(1, input.page), totalPages);

    const records = await db
      .select({
        id: transactions.id,
        date: transactions.date,
        transactionTypeId: transactions.transactionTypeId,
        itemId: transactions.itemId,
        unitPrice: transactions.unitPrice,
        quantity: transactions.quantity,
        amount: transactions.amount,
        createdAt: transactions.createdAt,
        updatedAt: transactions.updatedAt,
        itemCode: items.code,
        itemName: items.name,
      })
      .from(transactions)
      .leftJoin(items, eq(transactions.itemId, items.id))
      .where(dateFilter)
      .orderBy(desc(transactions.id))
      .limit(size)
      .offset((currentPage - 1) * size);

    const extraParams: Record<string, string> = {};
    if (input.dateFrom) extraParams.dateFrom = input.dateFrom;
    if (input.dateTo) extraParams.dateTo = input.dateTo;

    return { records, currentPage, totalPages, pageSize: size, extraParams };
  },
});
