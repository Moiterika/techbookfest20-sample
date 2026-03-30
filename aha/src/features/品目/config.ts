import type { Column, EntityConfig } from "../../components/crud/types";

export const 品目カラム: Column[] = [
  {
    key: "code",
    label: "品目コード",
    required: true,
    placeholder: "例: NPC-001",
  },
  { key: "name", label: "品目名", required: true, placeholder: "例: ノートPC" },
  { key: "category", label: "カテゴリ", placeholder: "例: 備品" },
  {
    key: "price",
    label: "単価",
    type: "number",
    format: true,
    defaultValue: 0,
    min: 0,
  },
  {
    key: "barcode",
    label: "バーコード",
    type: "barcode",
    placeholder: "例: 123456789",
  },
  { key: "_actions", label: "操作", type: "actions", width: "32" },
];

export const 品目エンティティ: EntityConfig = {
  tableName: "items",
  idPrefix: "item",
  baseUrl: "/api/品目",
  bodyTargetId: "items-body",
  paginationId: "items-pagination",
  displayNameKey: "name",
  deleteConfirmTemplate: "「{name}」を削除しますか？",
  alpineInitEditRow: (record) =>
    `{ barcodeVal: '${(record.barcode ?? "").replace(/'/g, "\\'")}' }`,
  alpineInitForm: "{ barcodeVal: '' }",
  formTitle: "新規品目登録",
  formAfterRequest:
    "if($event.detail.successful && $event.detail.elt === $el) { $el.reset(); open = false }",
  emptyMessage: "品目がありません",
};
