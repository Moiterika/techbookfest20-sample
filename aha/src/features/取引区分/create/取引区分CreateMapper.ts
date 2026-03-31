import type { 取引区分作成入力 } from "../../../lib/validation";
import type { 取引区分CreateArgs } from "./取引区分CreateArgs";

export const 取引区分CreateMapper: (
  input: 取引区分作成入力,
) => 取引区分CreateArgs = (input) => ({
  コード: input.コード,
  名称: input.名称,
  係数: input.係数,
});
