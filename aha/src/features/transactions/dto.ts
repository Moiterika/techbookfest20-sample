import { z } from "zod";
import { Money, Quantity } from "../shared/types";

/** 取引 作成・更新 DTO */
export const TransactionDto = z.object({
  date: z.string().min(1, "日付は必須です"),
  itemId: z.number().int().positive("品目を選択してください"),
  unitPrice: Money,
  quantity: Quantity,
});

export type TransactionDto = z.infer<typeof TransactionDto>;

/** 金額（unitPrice * quantity）を算出 */
export function calcAmount(dto: TransactionDto): number {
  return dto.unitPrice.value * dto.quantity.value;
}

/** フォーム入力からの変換 */
export function toTransactionDto(form: {
  date: string;
  itemId: number;
  unitPrice?: number;
  quantity?: number;
}): TransactionDto {
  return {
    date: form.date,
    itemId: form.itemId,
    unitPrice: { value: form.unitPrice ?? 0, cur: "JPY" },
    quantity: { value: form.quantity ?? 1, unit: "pcs" },
  };
}

/** DB 保存用に DTO をフラットに戻す */
export function fromTransactionDto(dto: TransactionDto) {
  return {
    date: dto.date,
    itemId: dto.itemId,
    unitPrice: dto.unitPrice.value,
    quantity: dto.quantity.value,
    amount: dto.unitPrice.value * dto.quantity.value,
  };
}
