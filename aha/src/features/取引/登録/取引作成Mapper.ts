import type { 取引作成入力 } from "../../../lib/validation";
import type { 取引登録Args } from "./取引登録Args";

export const 取引作成Mapper: (input: 取引作成入力) => 取引登録Args = (
  input,
) => ({
  date: input.date,
  transactionTypeId: input.transactionTypeId,
  itemId: input.itemId,
  unitPrice: input.unitPrice,
  quantity: input.quantity,
  amount: input.unitPrice * input.quantity,
});
