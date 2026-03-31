import type { BOM更新入力 } from "../../../lib/validation";
import { db } from "../../../db";
import { BOMテーブル } from "../../../db/schema";
import { eq, and, ne } from "drizzle-orm";

export const BOMUpdateValidate: (input: BOM更新入力) => Promise<void> = async (
  input,
) => {
  // コード+版の重複チェック（自分自身を除外）
  const [existing] = await db
    .select({ id: BOMテーブル.id })
    .from(BOMテーブル)
    .where(
      and(
        eq(BOMテーブル.コード, input.コード),
        eq(BOMテーブル.版, input.版),
        ne(BOMテーブル.id, input.id),
      ),
    )
    .limit(1);
  if (existing) {
    throw new Error("このBOMコード・版の組み合わせは既に登録されています");
  }

  // 明細バリデーション
  if (!input.明細.some((l) => l.区分 === 2)) {
    throw new Error("製造行が少なくとも1行必要です");
  }

  for (const line of input.明細) {
    if (!line.品目ID || !line.数量 || !line.単位) {
      throw new Error("各行の品目・数量・単位は必須です");
    }
    if (line.参照BOM版 && !line.参照BOMコード) {
      throw new Error("BOM版を指定する場合、BOMコードも必要です");
    }
  }

  const outputItemIds = new Set(
    input.明細.filter((l) => l.区分 === 2).map((l) => l.品目ID),
  );
  const duplicateItem = input.明細.find(
    (l) => l.区分 === 1 && outputItemIds.has(l.品目ID),
  );
  if (duplicateItem) {
    throw new Error("製造品目と投入品目に同じ品目は登録できません");
  }
};
