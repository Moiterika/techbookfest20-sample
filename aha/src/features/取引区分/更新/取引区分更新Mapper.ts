import type { 取引区分更新入力 } from "../../../lib/validation";
import type { 取引区分更新Args } from "./取引区分更新Args";

export const 取引区分更新Mapper: (
  input: 取引区分更新入力,
) => 取引区分更新Args = (input) => ({
  ID: input.ID,
  コード: input.コード,
  名称: input.名称,
  係数: input.係数,
});
