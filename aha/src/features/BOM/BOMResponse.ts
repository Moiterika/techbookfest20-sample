import type { Bom, BomLine } from "../../db/schema";

export type BOMResponse = Bom;

export type BOM明細Response = BomLine & {
  itemCode?: string | null;
  itemName?: string | null;
};

export type BOM詳細Response = Bom & {
  outputLines: BOM明細Response[];
  inputLines: BOM明細Response[];
};
