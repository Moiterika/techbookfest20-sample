import type { 品目作成入力 } from "../../../lib/validation";
import type { 品目登録Args } from "./品目登録Args";

export const 品目作成Mapper: (input: 品目作成入力) => 品目登録Args = (
  input,
) => ({
  code: input.code,
  name: input.name,
  category: input.category ?? null,
  price: input.price,
  barcode: input.barcode ?? null,
});
