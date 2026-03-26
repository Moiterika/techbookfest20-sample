import { z } from "zod";

/** 通貨型 — 金額に付与する通貨コード (ISO 4217) */
export const Currency = z.enum(["JPY", "USD", "EUR", "GBP", "CNY"]);

export type Currency = z.infer<typeof Currency>;

/** 通貨の表示記号 */
export const currencySymbols: Record<Currency, string> = {
  JPY: "¥",
  USD: "$",
  EUR: "€",
  GBP: "£",
  CNY: "¥",
};

/** 通貨の小数桁数 */
export const currencyDecimals: Record<Currency, number> = {
  JPY: 0,
  USD: 2,
  EUR: 2,
  GBP: 2,
  CNY: 2,
};
