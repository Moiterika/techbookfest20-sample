/**
 * BOM のコード生成用設定
 * gen-go.ts が参照する（Astro ランタイムでは使わない）
 */
import type { HeaderBodyConfig } from "../../components/crud/types";

/** 単位選択肢 — gen-go.ts の正規表現パーサー用にインライン定義 */
const unitOptions: { value: string; label: string }[] = [
  { value: "pcs", label: "個" },
  { value: "kg", label: "kg" },
  { value: "g", label: "g" },
  { value: "L", label: "L" },
  { value: "mL", label: "mL" },
  { value: "m", label: "m" },
  { value: "cm", label: "cm" },
  { value: "box", label: "箱" },
  { value: "set", label: "セット" },
  { value: "hour", label: "時間" },
];

export const tableName = "boms";

export const BOMヘッダーボディ: HeaderBodyConfig = {
  type: "header-body",
  tableName: "boms",
  idPrefix: "bom",
  baseUrl: "/api/BOM",
  bodyTargetId: "boms-body",
  paginationId: "boms-pagination",
  deleteConfirmTemplate: "「{name}」を削除しますか？",
  displayNameKey: "name",
  formTitle: "新規BOM登録",
  emptyMessage: "BOMがありません",
  headerColumns: [
    {
      key: "code",
      label: "BOMコード",
      required: true,
      placeholder: "例: BOM-001",
    },
    { key: "version", label: "版", required: true, placeholder: "例: 1" },
    {
      key: "name",
      label: "名称",
      required: true,
      placeholder: "例: 製品A 部品表",
    },
  ],
  children: [
    {
      tableName: "bom_lines",
      sectionLabel: "製造品目（アウトプット）",
      discriminator: { column: "type", value: 2 },
      columns: [
        { key: "itemCode", label: "品目コード", type: "itemCode" },
        { key: "itemName", label: "品目名", type: "readonlyLookup" },
        {
          key: "quantity",
          label: "数量",
          type: "number",
          min: 0,
          placeholder: "0",
        },
        {
          key: "unit",
          label: "単位",
          type: "select",
          options: [{ value: "pcs", label: "個" }, { value: "kg", label: "kg" }, { value: "g", label: "g" }, { value: "L", label: "L" }, { value: "mL", label: "mL" }, { value: "m", label: "m" }, { value: "cm", label: "cm" }, { value: "box", label: "箱" }, { value: "set", label: "セット" }, { value: "hour", label: "時間" }],
          defaultValue: "pcs",
        },
        { key: "_delete", label: "", type: "deleteAction", width: "3rem" },
      ],
    },
    {
      tableName: "bom_lines",
      sectionLabel: "投入品目（インプット）",
      discriminator: { column: "type", value: 1 },
      columns: [
        { key: "itemCode", label: "品目コード", type: "itemCode" },
        { key: "itemName", label: "品目名", type: "readonlyLookup" },
        {
          key: "quantity",
          label: "数量",
          type: "number",
          min: 0,
          placeholder: "0",
        },
        {
          key: "unit",
          label: "単位",
          type: "select",
          options: [{ value: "pcs", label: "個" }, { value: "kg", label: "kg" }, { value: "g", label: "g" }, { value: "L", label: "L" }, { value: "mL", label: "mL" }, { value: "m", label: "m" }, { value: "cm", label: "cm" }, { value: "box", label: "箱" }, { value: "set", label: "セット" }, { value: "hour", label: "時間" }],
          defaultValue: "pcs",
        },
        { key: "refBomCode", label: "BOMコード", placeholder: "BOMコード" },
        { key: "refBomVersion", label: "版", placeholder: "版" },
        { key: "_delete", label: "", type: "deleteAction", width: "3rem" },
      ],
    },
  ],
};
