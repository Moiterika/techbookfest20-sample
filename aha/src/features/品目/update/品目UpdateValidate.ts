import type { 品目更新入力 } from "../../../lib/validation";
import { db } from "../../../db";
import { 品目テーブル } from "../../../db/schema";
import { eq } from "drizzle-orm";

export const 品目UpdateValidate: (input: 品目更新入力) => Promise<void> = async (
  input,
) => {
  const [current] = await db
    .select({ コード: 品目テーブル.コード })
    .from(品目テーブル)
    .where(eq(品目テーブル.id, input.id))
    .limit(1);
  if (!current) {
    throw new Error("更新対象の品目が見つかりません");
  }
  if (current.コード !== input.コード) {
    throw new Error("品目コードは変更できません");
  }
};
