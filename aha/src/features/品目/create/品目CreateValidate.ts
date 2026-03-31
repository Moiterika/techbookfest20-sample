import type { 品目作成入力 } from "../../../lib/validation";
import { db } from "../../../db";
import { 品目テーブル } from "../../../db/schema";
import { eq } from "drizzle-orm";

export const 品目CreateValidate: (input: 品目作成入力) => Promise<void> = async (
  input,
) => {
  const [existing] = await db
    .select({ id: 品目テーブル.id })
    .from(品目テーブル)
    .where(eq(品目テーブル.コード, input.コード))
    .limit(1);
  if (existing) {
    throw new Error("この品目コードは既に登録されています");
  }
};
