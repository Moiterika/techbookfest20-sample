import type { 取引更新入力 } from "../../../lib/validation";
import type { 取引更新Args } from "./取引更新Args";

export const 取引更新Mapper: (input: 取引更新入力) => 取引更新Args = (
  input,
) => ({
  id: input.id,
  date: input.date,
  transactionTypeId: input.transactionTypeId,
  itemId: input.itemId,
  unitPrice: input.unitPrice,
  quantity: input.quantity,
  amount: input.unitPrice * input.quantity,
});
