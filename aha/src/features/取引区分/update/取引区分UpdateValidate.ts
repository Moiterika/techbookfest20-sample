import type { 取引区分更新入力 } from "../../../lib/validation";
import { db } from "../../../db";
import { 取引区分テーブル } from "../../../db/schema";
import { eq } from "drizzle-orm";

export const 取引区分UpdateValidate: (
  input: 取引区分更新入力,
) => Promise<void> = async (input) => {
  const [current] = await db
    .select({ コード: 取引区分テーブル.コード })
    .from(取引区分テーブル)
    .where(eq(取引区分テーブル.id, input.id))
    .limit(1);
  if (!current) {
    throw new Error("更新対象の取引区分が見つかりません");
  }
  if (current.コード !== input.コード) {
    throw new Error("取引区分コードは変更できません");
  }
};
