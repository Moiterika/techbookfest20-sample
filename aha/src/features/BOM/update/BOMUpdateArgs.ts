import type { BOM明細Args } from "../create/BOMCreateArgs";

export type BOMUpdateArgs = {
  id: number;
  コード: string;
  版: string;
  名称: string;
  明細: BOM明細Args[];
};
