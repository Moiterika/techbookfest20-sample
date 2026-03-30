import type { 取引区分作成入力 } from "../../../lib/validation";

/** 取引区分登録時のバリデーション（現状は追加ルールなし） */
export const 取引区分登録Validate: (
  input: 取引区分作成入力,
) => Promise<void> = async (_input) => {
  // 必要に応じてコード重複チェック等を追加
};
