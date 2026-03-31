import { GenericQuery } from "../../core/generic-query";
import { 品目一覧Schema, type 品目一覧入力 } from "../../../lib/validation";
import { db } from "../../../db";
import { 品目テーブル } from "../../../db/schema";
import { and, count, desc, ilike, or } from "drizzle-orm";
import type { 品目Response } from "../品目Response";

export type 品目一覧Result = {
  records: 品目Response[];
  currentPage: number;
  totalPages: number;
  pageSize: number;
  extraParams: Record<string, string>;
};

const PAGE_SIZES = [20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;

export const 品目一覧Query = new GenericQuery<品目一覧入力, 品目一覧Result>({
  schema: 品目一覧Schema,
  query: async (input) => {
    const size = PAGE_SIZES.includes(input.size as any)
      ? input.size
      : DEFAULT_PAGE_SIZE;

    const conditions = [];
    if (input.q) {
      conditions.push(
        or(
          ilike(品目テーブル.コード, `%${input.q}%`),
          ilike(品目テーブル.名称, `%${input.q}%`),
        ),
      );
    }
    if (input.カテゴリ) {
      conditions.push(ilike(品目テーブル.カテゴリ, `%${input.カテゴリ}%`));
    }
    const searchFilter = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(品目テーブル)
      .where(searchFilter);
    const totalPages = Math.max(1, Math.ceil(total / size));
    const currentPage = Math.min(Math.max(1, input.page), totalPages);

    const records = await db
      .select()
      .from(品目テーブル)
      .where(searchFilter)
      .orderBy(desc(品目テーブル.id))
      .limit(size)
      .offset((currentPage - 1) * size);

    const extraParams: Record<string, string> = {};
    if (input.q) extraParams.q = input.q;
    if (input.カテゴリ) extraParams.カテゴリ = input.カテゴリ;

    return { records, currentPage, totalPages, pageSize: size, extraParams };
  },
});
