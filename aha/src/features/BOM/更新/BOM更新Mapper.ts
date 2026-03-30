import type { BOM更新入力 } from "../../../lib/validation";
import type { BOM更新Args } from "./BOM更新Args";

export const BOM更新Mapper: (input: BOM更新入力) => BOM更新Args = (input) => ({
  id: input.id,
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
