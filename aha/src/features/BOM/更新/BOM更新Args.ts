import type { BOM明細Args } from "../登録/BOM登録Args";

export type BOM更新Args = {
  ID: number;
  コード: string;
  版: string;
  名称: string;
  明細: BOM明細Args[];
};
