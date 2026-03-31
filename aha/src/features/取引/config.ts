import type { Column, EntityConfig } from "../../components/crud/types";
import { db } from "../../db";
import { transactionTypes } from "../../db/schema";

/** 取引区分オプションをDBから取得する */
export async function fetch取引区分オプション(): Promise<
  { value: string; label: string }[]
> {
  const rows = await db
    .select()
    .from(transactionTypes)
    .orderBy(transactionTypes.id);
  return rows.map((r) => ({ value: String(r.id), label: r.name }));
}

/** 取引区分オプション付きのカラム定義を取得する */
export function get取引カラム(
  txTypeOptions: { value: string; label: string }[],
): Column[] {
  return [
    { key: "date", label: "日付", type: "date", required: true },
    {
      key: "transactionTypeId",
      label: "取引区分",
      type: "select",
      options: txTypeOptions,
      required: true,
    },
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
}

export const 取引エンティティ: EntityConfig = {
  searchFields: [
    { searchType: "date", param: "dateFrom", label: "開始日" },
    { searchType: "date", param: "dateTo", label: "終了日" },
  ],
  tableName: "transactions",
  idPrefix: "tx",
  baseUrl: "/api/取引",
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
