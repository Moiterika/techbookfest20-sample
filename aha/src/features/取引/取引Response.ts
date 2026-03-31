import type { 取引 } from "../../db/schema";

/** 取引の一覧用レスポンス（品目情報を含む） */
export type 取引Response = 取引 & {
  品目コード: string | null;
  品目名: string | null;
};
