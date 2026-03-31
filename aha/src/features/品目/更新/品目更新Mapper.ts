import type { 品目更新入力 } from "../../../lib/validation";
import type { 品目更新Args } from "./品目更新Args";

export const 品目更新Mapper: (input: 品目更新入力) => 品目更新Args = (
  input,
) => ({
  ID: input.ID,
  コード: input.コード,
  名称: input.名称,
  カテゴリ: input.カテゴリ ?? null,
  単価: input.単価,
  バーコード: input.バーコード ?? null,
});
