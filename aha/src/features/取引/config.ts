import type { Column, EntityConfig } from "../../components/crud/types";
import { db } from "../../db";
import { 取引区分テーブル } from "../../db/schema";

/** 取引区分オプションをDBから取得する */
export async function fetch取引区分オプション(): Promise<
  { value: string; label: string }[]
> {
  const rows = await db
    .select()
    .from(取引区分テーブル)
    .orderBy(取引区分テーブル.ID);
  return rows.map((r) => ({ value: String(r.ID), label: r.名称 }));
}

/** 取引区分オプション付きのカラム定義を取得する */
export function get取引カラム(
  txTypeOptions: { value: string; label: string }[],
): Column[] {
  return [
    { key: "日付", label: "日付", type: "date", required: true },
    {
      key: "取引区分ID",
      label: "取引区分",
      type: "select",
      options: txTypeOptions,
      required: true,
    },
    {
      key: "品目コード",
      label: "品目コード",
      type: "itemCode",
      valueName: "品目ID",
      required: true,
    },
    { key: "品目名", label: "品目名", type: "readonlyLookup" },
    {
      key: "単価",
      label: "単価",
      type: "number",
      format: true,
      required: true,
      min: 0,
      alpineModel: "unitPrice",
      defaultValue: 0,
    },
    {
      key: "数量",
      label: "数量",
      type: "number",
      format: true,
      required: true,
      min: 1,
      alpineModel: "quantity",
      defaultValue: 1,
    },
    {
      key: "金額",
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
    { searchType: "date", param: "開始日", label: "開始日" },
    { searchType: "date", param: "終了日", label: "終了日" },
  ],
  tableName: "取引",
  idPrefix: "tx",
  baseUrl: "/api/取引",
  bodyTargetId: "tx-body",
  paginationId: "tx-pagination",
  deleteConfirmTemplate: "この取引を削除しますか？",
  alpineInitEditRow: (record) =>
    `{ unitPrice: ${record.単価}, quantity: ${record.数量} }`,
  alpineInitForm: "{ unitPrice: 0, quantity: 1 }",
  formExtraAttrs: { "@item-selected": "unitPrice = $event.detail.price" },
  formBeforeRequest:
    "if(event.detail.elt === this && !this.querySelector('[name=品目ID]')?.value) { event.preventDefault(); alert('品目を選択してください'); }",
  formAfterRequest:
    "if($event.detail.successful && $event.detail.elt === $el) { $el.reset(); unitPrice = 0; quantity = 1; $dispatch('typeahead-reset'); open = false }",
  formTitle: "新規取引登録",
  emptyMessage: "取引がありません",
};
