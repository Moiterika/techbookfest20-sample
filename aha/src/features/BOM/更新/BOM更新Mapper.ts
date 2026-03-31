import type { BOM更新入力 } from "../../../lib/validation";
import type { BOM更新Args } from "./BOM更新Args";

export const BOM更新Mapper: (input: BOM更新入力) => BOM更新Args = (input) => ({
  ID: input.ID,
  コード: input.コード,
  版: input.版,
  名称: input.名称,
  明細: input.明細.map((l) => ({
    区分: l.区分,
    品目ID: l.品目ID,
    数量: l.数量,
    単位: l.単位,
    参照BOMコード: l.参照BOMコード ?? null,
    参照BOM版: l.参照BOM版 ?? null,
  })),
});
