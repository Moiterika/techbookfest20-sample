import type { 取引区分更新入力 } from "../../../lib/validation";
import type { 取引区分更新Args } from "./取引区分更新Args";

export const 取引区分更新Mapper: (
  input: 取引区分更新入力,
) => 取引区分更新Args = (input) => ({
  id: input.id,
  code: input.code,
  name: input.name,
  coefficient: input.coefficient,
});
