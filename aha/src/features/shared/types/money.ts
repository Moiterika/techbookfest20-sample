import { z } from "zod";
import { Currency, currencySymbols, currencyDecimals } from "./currency";

/** 金額型 — 値と通貨の組み合わせ */
export const Money = z.object({
  value: z.number(),
  cur: Currency,
});

export type Money = z.infer<typeof Money>;

/** Money を生成するヘルパー */
export function money(
  value: number,
  cur: z.infer<typeof Currency> = "JPY",
): Money {
  return { value, cur };
}

/** 表示用フォーマット */
export function formatMoney(m: Money): string {
  const decimals = currencyDecimals[m.cur];
  const formatted = m.value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${currencySymbols[m.cur]}${formatted}`;
}
