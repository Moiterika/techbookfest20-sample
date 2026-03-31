import type { TypeaheadConfig } from "../../components/crud/types";

export const 品目Typeahead: TypeaheadConfig = {
  entityName: "品目",
  tableName: "items",
  searchColumns: ["code", "name"],
  displayColumns: [{ key: "code", bold: true }, { key: "name" }],
  badgeDisplayKey: "code",
  nameLabelKey: "name",
  extraDataKeys: ["price"],
  placeholder: "品目コード or 名前で検索…",
};
