import { GenericQuery } from "../../core/generic-query";
import { BOM一覧Schema, type BOM一覧入力 } from "../../../lib/validation";
import { db } from "../../../db";
import { boms } from "../../../db/schema";
import { count, desc, ilike, or } from "drizzle-orm";
import type { BOMResponse } from "../BOMResponse";

export type BOM一覧Result = {
  records: BOMResponse[];
  currentPage: number;
  totalPages: number;
  pageSize: number;
  extraParams: Record<string, string>;
};

const PAGE_SIZES = [20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;

export const BOM一覧Query = new GenericQuery<BOM一覧入力, BOM一覧Result>({
  schema: BOM一覧Schema,
  query: async (input) => {
    const size = PAGE_SIZES.includes(input.size as any)
      ? input.size
      : DEFAULT_PAGE_SIZE;

    const searchFilter = input.q
      ? or(ilike(boms.code, `%${input.q}%`), ilike(boms.name, `%${input.q}%`))
      : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(boms)
      .where(searchFilter);
    const totalPages = Math.max(1, Math.ceil(total / size));
    const currentPage = Math.min(Math.max(1, input.page), totalPages);

    const records = await db
      .select()
      .from(boms)
      .where(searchFilter)
      .orderBy(desc(boms.id))
      .limit(size)
      .offset((currentPage - 1) * size);

    const extraParams: Record<string, string> = {};
    if (input.q) extraParams.q = input.q;

    return { records, currentPage, totalPages, pageSize: size, extraParams };
  },
});
