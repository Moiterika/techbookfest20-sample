import type { 品目更新入力 } from "../../../lib/validation";

export const 品目更新Validate: (input: 品目更新入力) => Promise<void> = async (
  _input,
) => {
  // 必要に応じて品目コード重複チェック等を追加
};
