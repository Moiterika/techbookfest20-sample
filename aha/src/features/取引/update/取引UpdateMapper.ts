import type { 取引更新入力 } from "../../../lib/validation";
import type { 取引UpdateArgs } from "./取引UpdateArgs";

export const 取引UpdateMapper: (input: 取引更新入力) => 取引UpdateArgs = (
  input,
) => ({
  id: input.id,
  日付: input.日付,
  取引区分ID: input.取引区分ID,
  品目ID: input.品目ID,
  単価: input.単価,
  数量: input.数量,
  金額: input.単価 * input.数量,
});
