import { z } from "zod";
import { Unit } from "./unit";

/** 数量型 — 値と単位の組み合わせ */
export const Quantity = z.object({
  value: z.number(),
  unit: Unit,
});

export type Quantity = z.infer<typeof Quantity>;

/** Quantity を生成するヘルパー */
export function qty(value: number, unit: z.infer<typeof Unit>): Quantity {
  return { value, unit };
}

/** 表示用フォーマット */
export function formatQuantity(q: Quantity): string {
  return `${q.value.toLocaleString()} ${q.unit}`;
}
