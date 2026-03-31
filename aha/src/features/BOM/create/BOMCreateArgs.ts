export type BOM明細Args = {
  区分: number;
  品目ID: number;
  数量: string;
  単位: string;
  参照BOMコード: string | null;
  参照BOM版: string | null;
};

export type BOMCreateArgs = {
  コード: string;
  版: string;
  名称: string;
  明細: BOM明細Args[];
};
