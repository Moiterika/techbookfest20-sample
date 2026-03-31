import type { BOM, BOM明細 } from "../../db/schema";

export type BOMResponse = BOM;

export type BOM明細Response = BOM明細 & {
  品目コード?: string | null;
  品目名?: string | null;
};

export type BOM詳細Response = BOM & {
  outputLines: BOM明細Response[];
  inputLines: BOM明細Response[];
};
