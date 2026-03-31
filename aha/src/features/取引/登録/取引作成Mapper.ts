import type { 取引作成入力 } from "../../../lib/validation";
import type { 取引登録Args } from "./取引登録Args";

export const 取引作成Mapper: (input: 取引作成入力) => 取引登録Args = (
  input,
) => ({
  日付: input.日付,
  取引区分ID: input.取引区分ID,
  品目ID: input.品目ID,
  単価: input.単価,
  数量: input.数量,
  金額: input.単価 * input.数量,
});
