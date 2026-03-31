import type { 取引更新入力 } from "../../../lib/validation";
import type { 取引更新Args } from "./取引更新Args";

export const 取引更新Mapper: (input: 取引更新入力) => 取引更新Args = (
  input,
) => ({
  ID: input.ID,
  日付: input.日付,
  取引区分ID: input.取引区分ID,
  品目ID: input.品目ID,
  単価: input.単価,
  数量: input.数量,
  金額: input.単価 * input.数量,
});
