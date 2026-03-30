import type { BOM明細Args } from "../登録/BOM登録Args";

export type BOM更新Args = {
  id: number;
  code: string;
  version: string;
  name: string;
  lines: BOM明細Args[];
};
