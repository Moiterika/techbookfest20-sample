import type { 取引区分作成入力 } from "../../../lib/validation";
import type { 取引区分登録Args } from "./取引区分登録Args";

export const 取引区分作成Mapper: (
  input: 取引区分作成入力,
) => 取引区分登録Args = (input) => ({
  コード: input.コード,
  名称: input.名称,
  係数: input.係数,
});
