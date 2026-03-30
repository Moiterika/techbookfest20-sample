import type { BOM更新入力 } from "../../../lib/validation";

export const BOM更新Validate: (input: BOM更新入力) => Promise<void> = async (
  input,
) => {
  if (!input.lines.some((l) => l.type === 2)) {
    throw new Error("製造行が少なくとも1行必要です");
  }

  for (const line of input.lines) {
    if (!line.itemId || !line.quantity || !line.unit) {
      throw new Error("各行の品目・数量・単位は必須です");
    }
    if (line.refBomVersion && !line.refBomCode) {
      throw new Error("BOM版を指定する場合、BOMコードも必要です");
    }
  }

  const outputItemIds = new Set(
    input.lines.filter((l) => l.type === 2).map((l) => l.itemId),
  );
  const duplicateItem = input.lines.find(
    (l) => l.type === 1 && outputItemIds.has(l.itemId),
  );
  if (duplicateItem) {
    throw new Error("製造品目と投入品目に同じ品目は登録できません");
  }
};
