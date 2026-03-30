import type { BOM作成入力 } from "../../../lib/validation";
import type { BOM登録Args } from "./BOM登録Args";

export const BOM作成Mapper: (input: BOM作成入力) => BOM登録Args = (input) => ({
  code: input.code,
  version: input.version,
  name: input.name,
  lines: input.lines.map((l) => ({
    type: l.type,
    itemId: l.itemId,
    quantity: l.quantity,
    unit: l.unit,
    refBomCode: l.refBomCode ?? null,
    refBomVersion: l.refBomVersion ?? null,
  })),
});
