import type { Column, EntityConfig } from "../../components/crud/types";

export const bomListColumns: Column[] = [
  { key: "code", label: "BOMコード" },
  { key: "version", label: "版" },
  { key: "name", label: "名称" },
  { key: "_actions", label: "操作", type: "actions", width: "32" },
];

export const bomEntity: EntityConfig = {
  idPrefix: "bom",
  baseUrl: "/api/boms",
  bodyTargetId: "boms-body",
  paginationId: "boms-pagination",
  displayNameKey: "name",
  deleteConfirmTemplate: "「{name}」を削除しますか？",
  formTitle: "新規BOM登録",
  emptyMessage: "BOMがありません",
};
