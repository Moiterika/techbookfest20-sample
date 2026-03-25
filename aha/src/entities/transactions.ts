import type { Column, EntityConfig } from "../components/crud/types";

export const txColumns: Column[] = [
  { key: "date", label: "日付", type: "date", required: true },
  {
    key: "itemCode",
    label: "品目コード",
    type: "itemCode",
    valueName: "itemId",
    required: true,
  },
  { key: "itemName", label: "品目名", type: "readonlyLookup" },
  {
    key: "unitPrice",
    label: "単価",
    type: "number",
    format: true,
    required: true,
    min: 0,
    alpineModel: "unitPrice",
    defaultValue: 0,
  },
  {
    key: "quantity",
    label: "数量",
    type: "number",
    format: true,
    required: true,
    min: 1,
    alpineModel: "quantity",
    defaultValue: 1,
  },
  {
    key: "amount",
    label: "金額",
    type: "computed",
    expression: "unitPrice * quantity",
    format: true,
  },
  { key: "_actions", label: "操作", type: "actions", width: "32" },
];

export const txEntity: EntityConfig = {
  idPrefix: "tx",
  baseUrl: "/api/transactions",
  bodyTargetId: "tx-body",
  paginationId: "tx-pagination",
  deleteConfirmTemplate: "この取引を削除しますか？",
  alpineInitEditRow: (record) =>
    `{ unitPrice: ${record.unitPrice}, quantity: ${record.quantity} }`,
  alpineInitForm: "{ unitPrice: 0, quantity: 1 }",
  formExtraAttrs: { "@item-selected": "unitPrice = $event.detail.price" },
  formBeforeRequest:
    "if(event.detail.elt === this && !this.querySelector('[name=itemId]')?.value) { event.preventDefault(); alert('品目を選択してください'); }",
  formAfterRequest:
    "if($event.detail.successful && $event.detail.elt === $el) { $el.reset(); unitPrice = 0; quantity = 1; $dispatch('typeahead-reset'); open = false }",
  formTitle: "新規取引登録",
  emptyMessage: "取引がありません",
};
