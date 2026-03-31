import type { Column, EntityConfig } from "../../components/crud/types";

export const 品目カラム: Column[] = [
  {
    key: "コード",
    label: "品目コード",
    required: true,
    placeholder: "例: NPC-001",
    readonlyOnEdit: true,
  },
  { key: "名称", label: "品目名", required: true, placeholder: "例: ノートPC" },
  { key: "カテゴリ", label: "カテゴリ", placeholder: "例: 備品" },
  {
    key: "単価",
    label: "単価",
    type: "number",
    format: true,
    defaultValue: 0,
    min: 0,
  },
  {
    key: "バーコード",
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
      dbColumns: ["コード", "名称"],
    },
    {
      searchType: "text",
      param: "カテゴリ",
      label: "カテゴリ",
      placeholder: "カテゴリ",
      flexClass: "min-w-[10rem]",
      dbColumns: ["カテゴリ"],
    },
  ],
  tableName: "品目",
  idPrefix: "item",
  baseUrl: "/api/品目",
  bodyTargetId: "items-body",
  paginationId: "items-pagination",
  displayNameKey: "名称",
  deleteConfirmTemplate: "「{名称}」を削除しますか？",
  alpineInitEditRow: (record) =>
    `{ barcodeVal: '${(record.バーコード ?? "").replace(/'/g, "\\'")}' }`,
  alpineInitForm: "{ barcodeVal: '' }",
  formTitle: "新規品目登録",
  formAfterRequest:
    "if($event.detail.successful && $event.detail.elt === $el) { $el.reset(); open = false }",
  emptyMessage: "品目がありません",
};
