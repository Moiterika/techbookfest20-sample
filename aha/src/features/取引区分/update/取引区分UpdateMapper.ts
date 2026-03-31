import type { 取引区分更新入力 } from "../../../lib/validation";
import type { 取引区分UpdateArgs } from "./取引区分UpdateArgs";

export const 取引区分UpdateMapper: (
  input: 取引区分更新入力,
) => 取引区分UpdateArgs = (input) => ({
  id: input.id,
  コード: input.コード,
  名称: input.名称,
  係数: input.係数,
});
