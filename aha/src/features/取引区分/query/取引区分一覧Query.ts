import { GenericQuery } from "../../core/generic-query";
import {
  取引区分一覧Schema,
  type 取引区分一覧入力,
} from "../../../lib/validation";
import { db } from "../../../db";
import { 取引区分テーブル } from "../../../db/schema";
import { count, desc } from "drizzle-orm";
import type { 取引区分Response } from "../取引区分Response";

export type 取引区分一覧Result = {
  records: 取引区分Response[];
  currentPage: number;
  totalPages: number;
  pageSize: number;
};

const PAGE_SIZES = [20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;

export const 取引区分一覧Query = new GenericQuery<
  取引区分一覧入力,
  取引区分一覧Result
>({
  schema: 取引区分一覧Schema,
  query: async (input) => {
    const size = PAGE_SIZES.includes(input.size as any)
      ? input.size
      : DEFAULT_PAGE_SIZE;

    const [{ total }] = await db
      .select({ total: count() })
      .from(取引区分テーブル);
    const totalPages = Math.max(1, Math.ceil(total / size));
    const currentPage = Math.min(Math.max(1, input.page), totalPages);

    const records = await db
      .select()
      .from(取引区分テーブル)
      .orderBy(desc(取引区分テーブル.id))
      .limit(size)
      .offset((currentPage - 1) * size);

    return { records, currentPage, totalPages, pageSize: size };
  },
});
