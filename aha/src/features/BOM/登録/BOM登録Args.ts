export type BOM明細Args = {
  type: number;
  itemId: number;
  quantity: string;
  unit: string;
  refBomCode: string | null;
  refBomVersion: string | null;
};

export type BOM登録Args = {
  code: string;
  version: string;
  name: string;
  lines: BOM明細Args[];
};
