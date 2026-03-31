import type { 品目作成入力 } from "../../../lib/validation";
import type { 品目登録Args } from "./品目登録Args";

export const 品目作成Mapper: (input: 品目作成入力) => 品目登録Args = (
  input,
) => ({
  コード: input.コード,
  名称: input.名称,
  カテゴリ: input.カテゴリ ?? null,
  単価: input.単価,
  バーコード: input.バーコード ?? null,
});
