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

export const tableName = "BOM";

export const BOMヘッダーボディ: HeaderBodyConfig = {
  type: "header-body",
  tableName: "BOM",
  idPrefix: "bom",
  baseUrl: "/api/BOM",
  bodyTargetId: "boms-body",
  paginationId: "boms-pagination",
  deleteConfirmTemplate: "「{name}」を削除しますか？",
  displayNameKey: "名称",
  formTitle: "新規BOM登録",
  emptyMessage: "BOMがありません",
  headerColumns: [
    {
      key: "コード",
      label: "BOMコード",
      required: true,
      placeholder: "例: BOM-001",
    },
    { key: "版", label: "版", required: true, placeholder: "例: 1" },
    {
      key: "名称",
      label: "名称",
      required: true,
      placeholder: "例: 製品A 部品表",
    },
  ],
  children: [
    {
      tableName: "BOM明細",
      sectionLabel: "製造品目（アウトプット）",
      discriminator: { column: "区分", value: 2 },
      columns: [
        { key: "品目コード", label: "品目コード", type: "itemCode" },
        { key: "品目名", label: "品目名", type: "readonlyLookup" },
        {
          key: "数量",
          label: "数量",
          type: "number",
          min: 0,
          placeholder: "0",
        },
        {
          key: "単位",
          label: "単位",
          type: "select",
          options: [
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
          ],
          defaultValue: "pcs",
        },
        { key: "_delete", label: "", type: "deleteAction", width: "3rem" },
      ],
    },
    {
      tableName: "BOM明細",
      sectionLabel: "投入品目（インプット）",
      discriminator: { column: "区分", value: 1 },
      columns: [
        { key: "品目コード", label: "品目コード", type: "itemCode" },
        { key: "品目名", label: "品目名", type: "readonlyLookup" },
        {
          key: "数量",
          label: "数量",
          type: "number",
          min: 0,
          placeholder: "0",
        },
        {
          key: "単位",
          label: "単位",
          type: "select",
          options: [
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
          ],
          defaultValue: "pcs",
        },
        { key: "参照BOMコード", label: "BOMコード", placeholder: "BOMコード" },
        { key: "参照BOM版", label: "版", placeholder: "版" },
        { key: "_delete", label: "", type: "deleteAction", width: "3rem" },
      ],
    },
  ],
};
