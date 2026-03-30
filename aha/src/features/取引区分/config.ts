import type { Column, EntityConfig } from "../../components/crud/types";

export const 係数オプション = [
  { value: "1", label: "入庫" },
  { value: "0", label: "なし" },
  { value: "-1", label: "出庫" },
];

export const 取引区分カラム: Column[] = [
  {
    key: "code",
    label: "取引区分コード",
    required: true,
    placeholder: "例: IN-001",
  },
  {
    key: "name",
    label: "取引区分名称",
    required: true,
    placeholder: "例: 仕入",
  },
  {
    key: "coefficient",
    label: "受払係数",
    type: "select",
    options: 係数オプション,
    required: true,
    defaultValue: "0",
  },
  { key: "_actions", label: "操作", type: "actions", width: "32" },
];

export const 取引区分エンティティ: EntityConfig = {
  idPrefix: "txtype",
  baseUrl: "/api/取引区分",
  bodyTargetId: "txtypes-body",
  paginationId: "txtypes-pagination",
  displayNameKey: "name",
  deleteConfirmTemplate: "「{name}」を削除しますか？",
  formTitle: "新規取引区分登録",
  formAfterRequest:
    "if($event.detail.successful && $event.detail.elt === $el) { $el.reset(); open = false }",
  emptyMessage: "取引区分がありません",
};
