import type { 品目作成入力 } from "../../../lib/validation";

export const 品目登録Validate: (input: 品目作成入力) => Promise<void> = async (
  _input,
) => {
  // 必要に応じて品目コード重複チェック等を追加
};
