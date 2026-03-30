import type { 品目更新入力 } from "../../../lib/validation";
import type { 品目更新Args } from "./品目更新Args";

export const 品目更新Mapper: (input: 品目更新入力) => 品目更新Args = (
  input,
) => ({
  id: input.id,
  code: input.code,
  name: input.name,
  category: input.category ?? null,
  price: input.price,
  barcode: input.barcode ?? null,
});
