import { z } from "zod";

/** 単位型 — 数量に付与する物理・論理単位 */
export const Unit = z.enum([
  "pcs", // 個
  "kg", // キログラム
  "g", // グラム
  "L", // リットル
  "mL", // ミリリットル
  "m", // メートル
  "cm", // センチメートル
  "box", // 箱
  "set", // セット
  "hour", // 時間
]);

export type Unit = z.infer<typeof Unit>;

/** 単位の日本語ラベル */
export const unitLabels: Record<Unit, string> = {
  pcs: "個",
  kg: "kg",
  g: "g",
  L: "L",
  mL: "mL",
  m: "m",
  cm: "cm",
  box: "箱",
  set: "セット",
  hour: "時間",
};
