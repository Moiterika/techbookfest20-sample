import type { TypeaheadConfig } from "../../components/crud/types";

export const 品目Typeahead: TypeaheadConfig = {
  entityName: "品目",
  tableName: "品目",
  searchColumns: ["コード", "名称"],
  displayColumns: [{ key: "コード", bold: true }, { key: "名称" }],
  badgeDisplayKey: "コード",
  nameLabelKey: "名称",
  extraDataKeys: ["price"],
  placeholder: "品目コード or 名前で検索…",
};
