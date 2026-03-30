import type { Transaction } from "../../db/schema";

/** 取引の一覧用レスポンス（品目情報を含む） */
export type 取引Response = Transaction & {
  itemCode: string | null;
  itemName: string | null;
};
