import type { 取引区分作成入力 } from "../../../lib/validation";
import { db } from "../../../db";
import { 取引区分テーブル } from "../../../db/schema";
import { eq } from "drizzle-orm";

export const 取引区分CreateValidate: (
  input: 取引区分作成入力,
) => Promise<void> = async (input) => {
  const [existing] = await db
    .select({ id: 取引区分テーブル.id })
    .from(取引区分テーブル)
    .where(eq(取引区分テーブル.コード, input.コード))
    .limit(1);
  if (existing) {
    throw new Error("この取引区分コードは既に登録されています");
  }
};
