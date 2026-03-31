import type { 品目更新入力 } from "../../../lib/validation";
import type { 品目UpdateArgs } from "./品目UpdateArgs";

export const 品目UpdateMapper: (input: 品目更新入力) => 品目UpdateArgs = (
  input,
) => ({
  id: input.id,
  コード: input.コード,
  名称: input.名称,
  カテゴリ: input.カテゴリ ?? null,
  単価: input.単価,
  バーコード: input.バーコード ?? null,
});
