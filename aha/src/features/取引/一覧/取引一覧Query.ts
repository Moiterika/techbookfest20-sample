import { GenericQuery } from "../../core/generic-query";
import { 取引一覧Schema, type 取引一覧入力 } from "../../../lib/validation";
import { db } from "../../../db";
import { 取引テーブル, 品目テーブル } from "../../../db/schema";
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
    if (input.開始日) conditions.push(gte(取引テーブル.日付, input.開始日));
    if (input.終了日) conditions.push(lte(取引テーブル.日付, input.終了日));
    const dateFilter = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(取引テーブル)
      .where(dateFilter);
    const totalPages = Math.max(1, Math.ceil(total / size));
    const currentPage = Math.min(Math.max(1, input.page), totalPages);

    const records = await db
      .select({
        ID: 取引テーブル.ID,
        日付: 取引テーブル.日付,
        取引区分ID: 取引テーブル.取引区分ID,
        品目ID: 取引テーブル.品目ID,
        単価: 取引テーブル.単価,
        数量: 取引テーブル.数量,
        金額: 取引テーブル.金額,
        作成日時: 取引テーブル.作成日時,
        更新日時: 取引テーブル.更新日時,
        品目コード: 品目テーブル.コード,
        品目名: 品目テーブル.名称,
      })
      .from(取引テーブル)
      .leftJoin(品目テーブル, eq(取引テーブル.品目ID, 品目テーブル.ID))
      .where(dateFilter)
      .orderBy(desc(取引テーブル.ID))
      .limit(size)
      .offset((currentPage - 1) * size);

    const extraParams: Record<string, string> = {};
    if (input.開始日) extraParams.開始日 = input.開始日;
    if (input.終了日) extraParams.終了日 = input.終了日;

    return { records, currentPage, totalPages, pageSize: size, extraParams };
  },
});
