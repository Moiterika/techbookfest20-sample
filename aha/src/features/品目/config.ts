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
  searchFields: [
    {
      searchType: "text",
      param: "q",
      label: "検索",
      placeholder: "品目コード・品目名で検索…",
      flexClass: "flex-1 min-w-[12.5rem]",
      dbColumns: ["code", "name"],
    },
    {
      searchType: "text",
      param: "category",
      label: "カテゴリ",
      placeholder: "カテゴリ",
      flexClass: "min-w-[10rem]",
      dbColumns: ["category"],
    },
  ],
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
