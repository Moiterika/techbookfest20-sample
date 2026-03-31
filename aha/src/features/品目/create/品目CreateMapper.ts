import type { 品目作成入力 } from "../../../lib/validation";
import type { 品目CreateArgs } from "./品目CreateArgs";

export const 品目CreateMapper: (input: 品目作成入力) => 品目CreateArgs = (
  input,
) => ({
  コード: input.コード,
  名称: input.名称,
  カテゴリ: input.カテゴリ ?? null,
  単価: input.単価,
  バーコード: input.バーコード ?? null,
});
