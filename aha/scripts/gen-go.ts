/**
 * gen-go.ts — aha → GoTH 半自動生成 (再整備版)
 *
 * 入力源:
 *   src/db/schema.ts           → DB Row 構造体
 *   src/lib/validation.ts      → Input 構造体
 *   src/features/X/config.ts   → Column[], EntityConfig → templ 生成 + handler 生成
 *
 * 出力先:
 *   goth/internal/features/    → package features (フラット、templ含む)
 *
 * 命名規則:
 *   ファイル名   : 日本語プレフィックス (品目_, 取引区分_, ...)
 *   package 名  : features (日本語なし、Go + templ 同居)
 *   型名・関数名 : {役割}{日本語名} (例: Response品目, Handler品目)
 *   APIパス     : 日本語 (/api/品目, /api/取引区分, ...)
 *
 * ルール:
 *   *_gen.*     → 毎回上書き
 *   *_manual_*  → 初回のみ生成 (既存保護)
 *   router.go, main.go, ui/layout/, ui/components/ → 生成しない
 */

import * as path from "path";
import * as fs from "fs";

// ─── CLI ──────────────────────────────────

const args = process.argv.slice(2);
const allMode = args.includes("--all");
const featureIdx = args.indexOf("--feature");
const singleFeature = featureIdx >= 0 ? args[featureIdx + 1] : null;

const ALL_FEATURES = ["取引区分", "品目", "取引", "BOM"] as const;
const featuresToGenerate = allMode
  ? [...ALL_FEATURES]
  : singleFeature
    ? [singleFeature]
    : ["取引区分"];

const srcRoot = path.resolve("src");
const gothRoot = path.resolve("../goth");
const featuresDir = path.join(gothRoot, "internal/features");
// templ も features に同居 (import cycle 回避)

// ─── Feature 対応表 ──────────────────────────

interface FeatureMapping {
  jpName: string; // 品目
  tableName: string; // items (DB)
  configExportPrefix: string; // 品目カラム, 品目エンティティ のプレフィックス
}

const FEATURE_MAP: Record<string, FeatureMapping> = {
  品目: {
    jpName: "品目",
    tableName: "items",
    configExportPrefix: "品目",
  },
  取引区分: {
    jpName: "取引区分",
    tableName: "transaction_types",
    configExportPrefix: "取引区分",
  },
  取引: {
    jpName: "取引",
    tableName: "transactions",
    configExportPrefix: "取引",
  },
  BOM: {
    jpName: "BOM",
    tableName: "boms",
    configExportPrefix: "BOM",
  },
};

// ─── IR ──────────────────────────────────

interface FieldDef {
  name: string;
  goName: string;
  goType: string;
  dbColumn: string;
  isNotNull: boolean;
  isPrimaryKey: boolean;
  hasDefault: boolean;
}

interface EntityDef {
  tableName: string;
  structName: string;
  fields: FieldDef[];
}

interface ColumnDef {
  key: string;
  label: string;
  type: string; // text, number, date, select, barcode, itemCode, readonlyLookup, computed, actions
  required: boolean;
  format: boolean;
  options: { value: string; label: string }[];
  expression: string; // computed用
  min?: number;
  defaultValue?: string;
  placeholder?: string;
}

interface EntityConfigDef {
  idPrefix: string;
  baseUrl: string; // /api/品目 等 — 日本語
  bodyTargetId: string;
  paginationId: string;
  formTitle: string;
  emptyMessage: string;
  deleteConfirmTemplate: string;
}

// ─── schema.ts パーサー ────────────────────

function parseSchemaFile(): Map<string, EntityDef> {
  const content = fs.readFileSync(path.join(srcRoot, "db/schema.ts"), "utf-8");
  const entities = new Map<string, EntityDef>();

  const tableStartRegex = /export const (\w+) = pgTable\("(\w+)",\s*\{/g;
  let startMatch;

  while ((startMatch = tableStartRegex.exec(content)) !== null) {
    const [, , tableName] = startMatch;
    const bodyStart = startMatch.index + startMatch[0].length;
    let depth = 1;
    let i = bodyStart;
    while (i < content.length && depth > 0) {
      if (content[i] === "{") depth++;
      else if (content[i] === "}") depth--;
      i++;
    }
    const body = content.slice(bodyStart, i - 1);
    const fields = parseTableFields(body);

    entities.set(tableName, {
      tableName,
      structName: toPascalCase(tableName) + "Row",
      fields,
    });
  }
  return entities;
}

function parseTableFields(body: string): FieldDef[] {
  const fields: FieldDef[] = [];
  const joined = body.replace(/\n\s+\./g, ".");
  for (const line of joined.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/**") || trimmed.startsWith("*")) continue;

    const m = trimmed.match(/^(\w+):\s*(serial|varchar|integer|numeric|timestamp|date)\("([^"]+)"[^)]*\)(.*)/);
    if (!m) continue;
    const [, fieldName, colType, dbColumn, rest] = m;
    const isPK = rest.includes(".primaryKey()");
    const isNotNull = rest.includes(".notNull()") || isPK;
    const hasDefault = rest.includes(".default(") || rest.includes(".defaultNow()") || isPK;

    fields.push({
      name: fieldName,
      goName: toPascalCase(fieldName),
      goType: pgTypeToGoType(colType, isNotNull),
      dbColumn,
      isNotNull,
      isPrimaryKey: isPK,
      hasDefault,
    });
  }
  return fields;
}

// ─── config.ts パーサー ────────────────────

function parseConfigFile(featureName: string): { columns: ColumnDef[]; entity: EntityConfigDef } | null {
  const configPath = path.join(srcRoot, `features/${featureName}/config.ts`);
  if (!fs.existsSync(configPath)) return null;
  const content = fs.readFileSync(configPath, "utf-8");

  const columns = parseColumns(content);
  const entity = parseEntityConfig(content);
  return { columns, entity };
}

function parseColumns(content: string): ColumnDef[] {
  const columns: ColumnDef[] = [];

  // Column[] の中身を抽出 (複数の Column[] 定義がある場合は最初のstaticなものを使う)
  // const XxxカラムOrget取引カラム の中身からオブジェクトリテラルを抽出
  const arrayMatch = content.match(/Column\[\]\s*=\s*\[([\s\S]*?)\];/);
  // 関数内の return [...] パターンも試す
  const funcMatch = content.match(/:\s*Column\[\]\s*\{[\s\S]*?return\s*\[([\s\S]*?)\];\s*\}/);
  const body = arrayMatch?.[1] ?? funcMatch?.[1] ?? "";

  // 各オブジェクトリテラル { ... } を抽出
  const objRegex = /\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
  let objMatch;
  while ((objMatch = objRegex.exec(body)) !== null) {
    const obj = objMatch[1];
    const col = parseColumnObject(obj);
    if (col) columns.push(col);
  }
  return columns;
}

function parseColumnObject(obj: string): ColumnDef | null {
  const key = extractString(obj, "key");
  const label = extractString(obj, "label");
  if (!key || !label) return null;

  const type = extractString(obj, "type") || "text";
  const required = obj.includes("required: true");
  const format = obj.includes("format: true");
  const expression = extractString(obj, "expression") || "";
  const placeholder = extractString(obj, "placeholder") || "";
  const defaultValue = extractString(obj, "defaultValue") || extractNumber(obj, "defaultValue") || "";

  const minMatch = obj.match(/min:\s*(\d+)/);
  const min = minMatch ? Number(minMatch[1]) : undefined;

  // options は簡易パースしない（select は動的な場合もあるため）
  const options: { value: string; label: string }[] = [];

  return { key, label, type, required, format, options, expression, min, defaultValue, placeholder };
}

function extractString(obj: string, key: string): string | null {
  const m = obj.match(new RegExp(`${key}:\\s*"([^"]*)"`));
  return m?.[1] ?? null;
}

function extractNumber(obj: string, key: string): string | null {
  const m = obj.match(new RegExp(`${key}:\\s*(\\d+)`));
  return m?.[1] ?? null;
}

function parseEntityConfig(content: string): EntityConfigDef {
  return {
    idPrefix: extractFromConfig(content, "idPrefix") || "row",
    baseUrl: extractFromConfig(content, "baseUrl") || "/api/unknown",
    bodyTargetId: extractFromConfig(content, "bodyTargetId") || "data-body",
    paginationId: extractFromConfig(content, "paginationId") || "data-pagination",
    formTitle: extractFromConfig(content, "formTitle") || "新規登録",
    emptyMessage: extractFromConfig(content, "emptyMessage") || "データがありません",
    deleteConfirmTemplate: extractFromConfig(content, "deleteConfirmTemplate") || "削除しますか？",
  };
}

function extractFromConfig(content: string, key: string): string | null {
  const m = content.match(new RegExp(`${key}:\\s*"([^"]*)"`));
  return m?.[1] ?? null;
}

// ─── ユーティリティ ────────────────────────

function toPascalCase(s: string): string {
  return s.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}

function pgTypeToGoType(colType: string, isNotNull: boolean): string {
  if (colType === "serial") return "int";
  if (colType === "integer") return isNotNull ? "int" : "sql.NullInt64";
  if (colType === "numeric") return "string";
  if (colType === "varchar") return isNotNull ? "string" : "sql.NullString";
  if (colType === "timestamp") return "time.Time";
  if (colType === "date") return "string";
  return "string";
}

function simpleGoType(goType: string): string {
  if (goType === "sql.NullString") return "string";
  if (goType === "sql.NullInt64") return "int";
  return goType;
}

// ─── Go コード生成: types_gen.go ───────────

function genTypes(entity: EntityDef, fm: FeatureMapping): string {
  const JP = fm.jpName;
  const lines: string[] = [];

  lines.push("// Code generated by gen-go.ts. DO NOT EDIT.");
  lines.push("package features");
  lines.push("");

  // imports
  const hasSqlNull = entity.fields.some((f) => f.goType.startsWith("sql."));
  const hasTime = entity.fields.some((f) => f.goType === "time.Time");
  if (hasSqlNull || hasTime) {
    lines.push("import (");
    if (hasSqlNull) lines.push('\t"database/sql"');
    if (hasTime) lines.push('\t"time"');
    lines.push(")");
    lines.push("");
  }

  // Row
  lines.push(`// Row${JP} は ${entity.tableName} テーブルの行`);
  lines.push(`type Row${JP} struct {`);
  for (const f of entity.fields) {
    lines.push(`\t${f.goName} ${f.goType} \`db:"${f.dbColumn}"\``);
  }
  lines.push("}");
  lines.push("");

  // Input structs
  const inputFields = entity.fields.filter((f) => !f.isPrimaryKey && !f.name.endsWith("At"));

  lines.push(`type 作成Input${JP} struct {`);
  for (const f of inputFields) {
    lines.push(`\t${f.goName} ${f.isNotNull ? simpleGoType(f.goType) : `*${simpleGoType(f.goType)}`}`);
  }
  lines.push("}");
  lines.push("");

  lines.push(`type 更新Input${JP} struct {`);
  lines.push("\tID int");
  for (const f of inputFields) {
    lines.push(`\t${f.goName} ${f.isNotNull ? simpleGoType(f.goType) : `*${simpleGoType(f.goType)}`}`);
  }
  lines.push("}");
  lines.push("");

  lines.push(`type 削除Input${JP} struct { ID int }`);
  lines.push(`type 一括削除Input${JP} struct { IDs []int }`);
  lines.push(`type 一覧Input${JP} struct { Page int; Size int; Search string }`);
  lines.push("");

  // Response / ListResult
  lines.push(`type Response${JP} struct { Row${JP} }`);
  lines.push("");
  lines.push(`type ListResult${JP} struct {`);
  lines.push(`\tRecords     []Response${JP}`);
  lines.push("\tCurrentPage int");
  lines.push("\tTotalPages  int");
  lines.push("\tPageSize    int");
  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

// ─── Go コード生成: service_gen.go ─────────

function genService(fm: FeatureMapping): string {
  const JP = fm.jpName;
  const lines: string[] = [];

  lines.push("// Code generated by gen-go.ts. DO NOT EDIT.");
  lines.push("package features");
  lines.push("");
  lines.push('import (\n\t"context"\n\t"database/sql"\n)');
  lines.push("");

  lines.push(`type Handler${JP} struct { DB *sql.DB }`);
  lines.push("");
  lines.push(`func NewHandler${JP}(db *sql.DB) *Handler${JP} {`);
  lines.push(`\treturn &Handler${JP}{DB: db}`);
  lines.push("}");
  lines.push("");

  // 各メソッド — manual_sql.go の関数を呼ぶ
  const ops = [
    { method: `Get一覧${JP}`, sig: `(ctx context.Context, input 一覧Input${JP}) (ListResult${JP}, error)`, call: `Execute一覧SQL${JP}(ctx, h.DB, input)` },
    { method: `Execute登録${JP}`, sig: `(ctx context.Context, input 作成Input${JP}) (Response${JP}, error)`, call: `Execute登録SQL${JP}(ctx, h.DB, input)`, validate: true },
    { method: `Execute更新${JP}`, sig: `(ctx context.Context, input 更新Input${JP}) (Response${JP}, error)`, call: `Execute更新SQL${JP}(ctx, h.DB, input)`, validate: true },
    { method: `Execute削除${JP}`, sig: `(ctx context.Context, input 削除Input${JP}) error`, call: `Execute削除SQL${JP}(ctx, h.DB, input)` },
    { method: `Execute一括削除${JP}`, sig: `(ctx context.Context, input 一括削除Input${JP}) error`, call: `Execute一括削除SQL${JP}(ctx, h.DB, input)` },
    { method: `GetByID${JP}`, sig: `(ctx context.Context, id int) (Response${JP}, error)`, call: `GetByIDSQL${JP}(ctx, h.DB, id)` },
  ];

  for (const op of ops) {
    lines.push(`func (h *Handler${JP}) ${op.method}${op.sig} {`);
    if (op.validate) {
      const validateName = op.method.replace("Execute", "Validate");
      const isErrorOnly = op.sig.includes(") error");
      const zeroVal = isErrorOnly ? "" : `Response${JP}{}`;
      lines.push(`\tif err := ${validateName}(ctx, h.DB, input); err != nil {`);
      lines.push(isErrorOnly ? `\t\treturn err` : `\t\treturn ${zeroVal}, err`);
      lines.push("\t}");
    }
    lines.push(`\treturn ${op.call}`);
    lines.push("}");
    lines.push("");
  }

  return lines.join("\n");
}

// ─── Go コード生成: handler_gen.go ─────────

function genHandler(fm: FeatureMapping, config: EntityConfigDef | null): string {
  const JP = fm.jpName;
  const apiPath = config?.baseUrl ?? `/api/${fm.jpName}`;

  const lines: string[] = [];
  lines.push("// Code generated by gen-go.ts. DO NOT EDIT.");
  lines.push("package features");
  lines.push("");
  lines.push('import (\n\t"net/http"\n\t"strconv"\n)');
  lines.push("");

  // RegisterRoutes
  lines.push(`func (h *Handler${JP}) RegisterRoutes${JP}(mux *http.ServeMux) {`);
  lines.push(`\tmux.HandleFunc("GET /${JP}", h.HandlePage${JP})`);
  lines.push(`\tmux.HandleFunc("GET ${apiPath}", h.Handle一覧${JP})`);
  lines.push(`\tmux.HandleFunc("POST ${apiPath}", h.Handle登録${JP})`);
  lines.push(`\tmux.HandleFunc("DELETE ${apiPath}", h.Handle一括削除${JP})`);
  lines.push(`\tmux.HandleFunc("PUT ${apiPath}/{id}", h.Handle更新${JP})`);
  lines.push(`\tmux.HandleFunc("DELETE ${apiPath}/{id}", h.Handle削除${JP})`);
  lines.push(`\tmux.HandleFunc("GET ${apiPath}/{id}/edit", h.HandleEdit${JP})`);
  lines.push("}");
  lines.push("");

  // HandlePage
  lines.push(`func (h *Handler${JP}) HandlePage${JP}(w http.ResponseWriter, r *http.Request) {`);
  lines.push(`\tw.Header().Set("Content-Type", "text/html; charset=utf-8")`);
  lines.push(`\tRenderPage${JP}().Render(r.Context(), w)`);
  lines.push("}");
  lines.push("");

  // Handle一覧
  lines.push(`func (h *Handler${JP}) Handle一覧${JP}(w http.ResponseWriter, r *http.Request) {`);
  lines.push(`\tpage, _ := strconv.Atoi(r.URL.Query().Get("page"))`);
  lines.push("\tif page < 1 { page = 1 }");
  lines.push(`\tsize, _ := strconv.Atoi(r.URL.Query().Get("size"))`);
  lines.push("\tif size < 1 { size = 20 }");
  lines.push(`\tsearch := r.URL.Query().Get("q")`);
  lines.push(`\tresult, err := h.Get一覧${JP}(r.Context(), 一覧Input${JP}{Page: page, Size: size, Search: search})`);
  lines.push("\tif err != nil {");
  lines.push("\t\thttp.Error(w, err.Error(), http.StatusInternalServerError)");
  lines.push("\t\treturn");
  lines.push("\t}");
  lines.push(`\tw.Header().Set("Content-Type", "text/html; charset=utf-8")`);
  lines.push(`\tRenderRows${JP}(result).Render(r.Context(), w)`);
  lines.push("}");
  lines.push("");

  // Handle登録
  lines.push(`func (h *Handler${JP}) Handle登録${JP}(w http.ResponseWriter, r *http.Request) {`);
  lines.push("\tif err := r.ParseForm(); err != nil {");
  lines.push(`\t\thttp.Error(w, "Bad request", http.StatusBadRequest)`);
  lines.push("\t\treturn");
  lines.push("\t}");
  lines.push(`\tinput := Parse作成Form${JP}(r)`);
  lines.push(`\t_, err := h.Execute登録${JP}(r.Context(), input)`);
  lines.push("\tif err != nil {");
  lines.push(`\t\tw.Header().Set("Content-Type", "text/html; charset=utf-8")`);
  lines.push("\t\tw.WriteHeader(http.StatusUnprocessableEntity)");
  lines.push(`\t\tRenderErrorMessage(err.Error()).Render(r.Context(), w)`);
  lines.push("\t\treturn");
  lines.push("\t}");
  lines.push(`\tlistResult, err := h.Get一覧${JP}(r.Context(), 一覧Input${JP}{Page: 1, Size: 20})`);
  lines.push("\tif err != nil {");
  lines.push("\t\thttp.Error(w, err.Error(), http.StatusInternalServerError)");
  lines.push("\t\treturn");
  lines.push("\t}");
  lines.push(`\tw.Header().Set("Content-Type", "text/html; charset=utf-8")`);
  lines.push(`\tw.Header().Set("HX-Trigger", \`{"show-toast": "登録しました"}\`)`);
  lines.push(`\tRenderRows${JP}(listResult).Render(r.Context(), w)`);
  lines.push("}");
  lines.push("");

  // Handle更新
  lines.push(`func (h *Handler${JP}) Handle更新${JP}(w http.ResponseWriter, r *http.Request) {`);
  lines.push(`\tid, err := strconv.Atoi(r.PathValue("id"))`);
  lines.push("\tif err != nil {");
  lines.push(`\t\thttp.Error(w, "Invalid ID", http.StatusBadRequest)`);
  lines.push("\t\treturn");
  lines.push("\t}");
  lines.push("\tif err := r.ParseForm(); err != nil {");
  lines.push(`\t\thttp.Error(w, "Bad request", http.StatusBadRequest)`);
  lines.push("\t\treturn");
  lines.push("\t}");
  lines.push(`\tinput := Parse更新Form${JP}(r, id)`);
  lines.push(`\tresult, err := h.Execute更新${JP}(r.Context(), input)`);
  lines.push("\tif err != nil {");
  lines.push(`\t\tw.Header().Set("Content-Type", "text/html; charset=utf-8")`);
  lines.push("\t\tw.WriteHeader(http.StatusUnprocessableEntity)");
  lines.push(`\t\tRenderErrorMessage(err.Error()).Render(r.Context(), w)`);
  lines.push("\t\treturn");
  lines.push("\t}");
  lines.push(`\tw.Header().Set("Content-Type", "text/html; charset=utf-8")`);
  lines.push(`\tw.Header().Set("HX-Trigger", \`{"show-toast": "更新しました"}\`)`);
  lines.push(`\tRenderRow${JP}(result).Render(r.Context(), w)`);
  lines.push("}");
  lines.push("");

  // Handle削除
  lines.push(`func (h *Handler${JP}) Handle削除${JP}(w http.ResponseWriter, r *http.Request) {`);
  lines.push(`\tid, err := strconv.Atoi(r.PathValue("id"))`);
  lines.push("\tif err != nil {");
  lines.push(`\t\thttp.Error(w, "Invalid ID", http.StatusBadRequest)`);
  lines.push("\t\treturn");
  lines.push("\t}");
  lines.push(`\tif err := h.Execute削除${JP}(r.Context(), 削除Input${JP}{ID: id}); err != nil {`);
  lines.push("\t\thttp.Error(w, err.Error(), http.StatusInternalServerError)");
  lines.push("\t\treturn");
  lines.push("\t}");
  lines.push(`\tw.Header().Set("Content-Type", "text/html; charset=utf-8")`);
  lines.push("}");
  lines.push("");

  // Handle一括削除
  lines.push(`func (h *Handler${JP}) Handle一括削除${JP}(w http.ResponseWriter, r *http.Request) {`);
  lines.push("\tif err := r.ParseForm(); err != nil {");
  lines.push(`\t\thttp.Error(w, "Bad request", http.StatusBadRequest)`);
  lines.push("\t\treturn");
  lines.push("\t}");
  lines.push(`\tids := ParseIntSlice(r.Form["ids[]"])`);
  lines.push(`\tif err := h.Execute一括削除${JP}(r.Context(), 一括削除Input${JP}{IDs: ids}); err != nil {`);
  lines.push("\t\thttp.Error(w, err.Error(), http.StatusInternalServerError)");
  lines.push("\t\treturn");
  lines.push("\t}");
  lines.push("\tw.WriteHeader(http.StatusOK)");
  lines.push("}");
  lines.push("");

  // HandleEdit
  lines.push(`func (h *Handler${JP}) HandleEdit${JP}(w http.ResponseWriter, r *http.Request) {`);
  lines.push(`\tid, err := strconv.Atoi(r.PathValue("id"))`);
  lines.push("\tif err != nil {");
  lines.push(`\t\thttp.Error(w, "Invalid ID", http.StatusBadRequest)`);
  lines.push("\t\treturn");
  lines.push("\t}");
  lines.push(`\titem, err := h.GetByID${JP}(r.Context(), id)`);
  lines.push("\tif err != nil {");
  lines.push("\t\thttp.Error(w, err.Error(), http.StatusNotFound)");
  lines.push("\t\treturn");
  lines.push("\t}");
  lines.push(`\tw.Header().Set("Content-Type", "text/html; charset=utf-8")`);
  lines.push(`\tRenderEditRow${JP}(item).Render(r.Context(), w)`);
  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

// ─── templ 生成: views_gen.templ ───────────

function genViewsTempl(entity: EntityDef, fm: FeatureMapping, columns: ColumnDef[], config: EntityConfigDef): string {
  const JP = fm.jpName;
  const apiPath = config.baseUrl;

  // データカラム (actions以外)
  const dataCols = columns.filter((c) => c.type !== "actions");
  // 全カラム
  const allCols = columns;
  const colCount = allCols.length + 1; // +1 for checkbox

  // ���─ Tailwind クラス定数 ──
  const TW = {
    thCell: "py-4 px-6 text-[0.625rem] font-bold text-on-surface-variant uppercase tracking-widest",
    tdCell: "py-4 px-6 text-on-surface-variant text-sm",
    row: "transition-all duration-200 ease-in-out hover:bg-surface-container-low [&.htmx-swapping]:opacity-0",
    inputStyle: "rounded-lg text-sm text-on-surface outline-none bg-surface-container-low border-2 border-transparent transition-[border-color,background-color] duration-200 focus:border-b-primary focus:bg-white px-3 py-2.5",
    inputStyleSm: "rounded-lg text-sm text-on-surface outline-none bg-surface-container-low border-2 border-transparent transition-[border-color,background-color] duration-200 focus:border-b-primary focus:bg-white py-1.5 px-2.5 w-full min-w-[7.5rem]",
    labelStyle: "flex flex-col gap-2 text-[0.625rem] font-bold uppercase tracking-wider text-outline",
    buttonPrimary: "text-sm py-2 px-4 rounded-lg cursor-pointer font-semibold transition-all duration-200 inline-flex items-center justify-center border-none bg-gradient-to-br from-primary to-primary-dark text-white hover:opacity-90 active:opacity-80",
    buttonSecondary: "text-sm py-2 px-4 rounded-lg cursor-pointer font-semibold transition-all duration-200 inline-flex items-center justify-center border-none bg-transparent text-primary hover:bg-surface-container-high active:bg-surface-container-highest",
    ghostBtn: "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all duration-150 text-primary bg-transparent border-none hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent",
    ghostBtnDanger: "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all duration-150 text-error bg-error-container/20 border-none hover:bg-error-container/40 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-error-container/20",
    card: "mb-6 p-6 rounded-xl bg-white",
    cardTitle: "text-lg font-bold text-on-surface mb-4 tracking-tight",
    pageContainer: "max-w-[87.5rem] mx-auto py-8 px-8",
    pageTitle: "text-2xl font-bold mb-8 text-on-surface tracking-tight",
    paginationBar: "flex justify-between items-center py-4 px-6 bg-surface-container-low rounded-b-xl flex-wrap gap-3",
    activePageBtn: "w-8 h-8 flex items-center justify-center text-xs font-bold rounded-lg bg-gradient-to-br from-primary to-primary-dark text-white cursor-default border-none",
    inactivePageBtn: "w-8 h-8 flex items-center justify-center text-xs font-bold rounded-lg cursor-pointer text-on-surface hover:bg-surface-container-high border-none",
    disabledPageBtn: "w-8 h-8 flex items-center justify-center text-xs rounded-lg text-outline-variant cursor-default border-none",
  };

  // 検索プレースホルダ — テキスト列ラベルから生成
  const textLabels = dataCols.filter((c) => c.type === "text" || c.type === undefined).map((c) => c.label).slice(0, 2);
  const searchPlaceholder = textLabels.length > 0 ? `${textLabels.join("・")}で検索…` : "検索…";
  const searchContainerId = `${JP}-search`;

  const lines: string[] = [];
  lines.push("// Code generated by gen-go.ts. DO NOT EDIT.");
  lines.push("package features");
  lines.push("");
  lines.push("import (");
  lines.push('\t"fmt"');
  lines.push('\t"aha-goth/internal/ui"');
  lines.push(")");
  lines.push("");

  // ── Page ──
  lines.push(`templ RenderPage${JP}() {`);
  lines.push(`\t@ui.Base("${JP}管理") {`);
  lines.push(`\t\t<main class="${TW.pageContainer}">`);
  lines.push(`\t\t\t<nav class="mb-4">`);
  lines.push(`\t\t\t\t<a href="/" class="text-primary no-underline hover:underline">← ホーム</a>`);
  lines.push(`\t\t\t</nav>`);
  lines.push(`\t\t\t<h1 class="${TW.pageTitle}">${JP}管理</h1>`);
  // 検索パネル
  lines.push(`\t\t\t<div id="${searchContainerId}" class="${TW.card}">`);
  lines.push(`\t\t\t\t<div class="flex gap-4 flex-wrap">`);
  lines.push(`\t\t\t\t\t<div class="${TW.labelStyle} flex-1 min-w-[12.5rem]">`);
  lines.push(`\t\t\t\t\t\t<span>検索</span>`);
  lines.push(`\t\t\t\t\t\t<input type="search" name="q" placeholder="${searchPlaceholder}" class="${TW.inputStyle}" hx-get="${apiPath}" hx-trigger="input changed delay:300ms, search" hx-target="#${config.bodyTargetId}" hx-swap="innerHTML" hx-include="#${searchContainerId}" hx-vals='{"page": "1"}'/>`);
  lines.push(`\t\t\t\t\t</div>`);
  lines.push(`\t\t\t\t</div>`);
  lines.push(`\t\t\t</div>`);
  // ツールバー + フォーム
  lines.push(`\t\t\t<div x-data="{ open: false }">`);
  // ツールバー
  lines.push(`\t\t\t\t<div class="flex justify-between items-center mb-6 flex-wrap gap-4" x-data="{ hasSelection: false, updateSelection() { const tbody = document.getElementById('${config.bodyTargetId}'); this.hasSelection = tbody ? tbody.querySelectorAll('input[name=\\'rowSelect\\']:checked').length > 0 : false; } }" @change.window="updateSelection()" hx-on--after-swap.window="$nextTick(() => this.updateSelection())">`);
  lines.push(`\t\t\t\t\t<div class="flex items-center gap-3 flex-wrap">`);
  lines.push(`\t\t\t\t\t\t<button class="${TW.ghostBtnDanger}" data-bulk-delete="${apiPath}" data-body-target="${config.bodyTargetId}" :disabled="!hasSelection">選択削除</button>`);
  lines.push(`\t\t\t\t\t</div>`);
  lines.push(`\t\t\t\t\t<div class="flex items-center gap-3 flex-wrap">`);
  lines.push(`\t\t\t\t\t\t<button class="${TW.ghostBtn}" hx-get="${apiPath}" hx-target="#${config.bodyTargetId}" hx-swap="innerHTML">更新</button>`);
  lines.push(`\t\t\t\t\t\t<button @click="open = !open" x-text="open ? '閉じる' : '＋ 新規追加'" class="${TW.buttonPrimary}"></button>`);
  lines.push(`\t\t\t\t\t</div>`);
  lines.push(`\t\t\t\t</div>`);
  // フォーム
  lines.push(`\t\t\t\t<div x-show="open" x-transition class="${TW.card}">`);
  lines.push(`\t\t\t\t\t<h2 class="${TW.cardTitle}">${config.formTitle}</h2>`);
  lines.push(`\t\t\t\t\t<form hx-post="${apiPath}" hx-target="#${config.bodyTargetId}" hx-swap="innerHTML" hx-on--after-request="if(event.detail.successful && event.detail.elt === this) { this.reset(); open = false }" class="flex flex-col gap-4">`);
  for (const col of dataCols) {
    if (col.type === "computed" || col.type === "readonlyLookup") continue;
    lines.push(`\t\t\t\t\t\t${genStyledFormField(col, TW)}`);
  }
  lines.push(`\t\t\t\t\t\t<div class="mt-2"><button type="submit" class="${TW.buttonPrimary}">登録する</button></div>`);
  lines.push(`\t\t\t\t\t</form>`);
  lines.push(`\t\t\t\t</div>`);
  lines.push(`\t\t\t</div>`);
  // テーブル
  lines.push(`\t\t\t<div class="overflow-x-auto rounded-xl bg-white [-webkit-overflow-scrolling:touch]">`);
  lines.push(`\t\t\t\t<table class="w-full min-w-[50rem] border-collapse text-left">`);
  lines.push(`\t\t\t\t\t<thead class="bg-surface-container">`);
  lines.push(`\t\t\t\t\t\t<tr>`);
  lines.push(`\t\t\t\t\t\t\t<th class="py-4 px-6 w-10"><input type="checkbox" class="crud-select-all rounded-sm cursor-pointer accent-primary" data-body-id="${config.bodyTargetId}"/></th>`);
  for (const col of allCols) {
    lines.push(`\t\t\t\t\t\t\t<th class="${TW.thCell}">${col.label}</th>`);
  }
  lines.push(`\t\t\t\t\t\t</tr>`);
  lines.push(`\t\t\t\t\t</thead>`);
  lines.push(`\t\t\t\t\t<tbody id="${config.bodyTargetId}" hx-get="${apiPath}" hx-trigger="load" hx-swap="innerHTML"></tbody>`);
  lines.push(`\t\t\t\t</table>`);
  lines.push(`\t\t\t</div>`);
  lines.push(`\t\t\t<div id="${config.paginationId}"></div>`);
  lines.push(`\t\t</main>`);
  lines.push(`\t\t@ui.Notifications()`);
  lines.push(`\t}`);
  lines.push("}");
  lines.push("");

  // ── Row ──
  lines.push(`templ RenderRow${JP}(item Response${JP}) {`);
  lines.push(`\t<tr id={ fmt.Sprintf("${config.idPrefix}-%d", item.Id) } class="${TW.row}">`);
  lines.push(`\t\t<td class="py-4 px-6 w-10"><input type="checkbox" name="rowSelect" value={ fmt.Sprintf("%d", item.Id) } class="rounded-sm cursor-pointer accent-primary"/></td>`);
  for (const col of dataCols) {
    lines.push(`\t\t${genStyledRowCell(col, entity, TW)}`);
  }
  // 操作列
  lines.push(`\t\t<td class="${TW.tdCell}">`);
  lines.push(`\t\t\t<div class="flex gap-2">`);
  lines.push(`\t\t\t\t<button class="${TW.buttonSecondary}" hx-get={ fmt.Sprintf("${apiPath}/%d/edit", item.Id) } hx-target={ fmt.Sprintf("#${config.idPrefix}-%d", item.Id) } hx-swap="outerHTML">編集</button>`);
  lines.push(`\t\t\t\t<button class="${TW.ghostBtnDanger}" hx-delete={ fmt.Sprintf("${apiPath}/%d", item.Id) } hx-target={ fmt.Sprintf("#${config.idPrefix}-%d", item.Id) } hx-swap="outerHTML swap:0.3s" hx-confirm="${config.deleteConfirmTemplate}">削除</button>`);
  lines.push(`\t\t\t</div>`);
  lines.push("\t\t</td>");
  lines.push("\t</tr>");
  lines.push("}");
  lines.push("");

  // ── EditRow ──
  lines.push(`templ RenderEditRow${JP}(item Response${JP}) {`);
  lines.push(`\t<tr id={ fmt.Sprintf("${config.idPrefix}-%d", item.Id) } class="bg-surface-container-low">`);
  lines.push(`\t\t<td class="py-4 px-6 w-10"></td>`);
  for (const col of dataCols) {
    lines.push(`\t\t${genStyledEditCell(col, apiPath, config.idPrefix, entity, TW)}`);
  }
  lines.push(`\t\t<td class="${TW.tdCell}">`);
  lines.push(`\t\t\t<div class="flex gap-2">`);
  lines.push(`\t\t\t\t<button class="${TW.buttonPrimary}" hx-put={ fmt.Sprintf("${apiPath}/%d", item.Id) } hx-target={ fmt.Sprintf("#${config.idPrefix}-%d", item.Id) } hx-swap="outerHTML" hx-include={ fmt.Sprintf("#edit-form-%d", item.Id) }>保存</button>`);
  lines.push(`\t\t\t\t<button class="${TW.buttonSecondary}" hx-get={ fmt.Sprintf("${apiPath}/%d/edit", item.Id) } hx-target={ fmt.Sprintf("#${config.idPrefix}-%d", item.Id) } hx-swap="outerHTML">キャンセル</button>`);
  lines.push(`\t\t\t</div>`);
  lines.push("\t\t</td>");
  lines.push("\t</tr>");
  lines.push("}");
  lines.push("");

  // ── Rows + Pagination ──
  lines.push(`templ RenderRows${JP}(result ListResult${JP}) {`);
  lines.push("\tfor _, item := range result.Records {");
  lines.push(`\t\t@RenderRow${JP}(item)`);
  lines.push("\t}");
  lines.push("\tif len(result.Records) == 0 {");
  lines.push(`\t\t<tr><td colspan="${colCount}" class="text-center py-8 text-outline">${config.emptyMessage}</td></tr>`);
  lines.push("\t}");
  lines.push(`\t@RenderPagination${JP}(result)`);
  lines.push("}");
  lines.push("");

  // ── Pagination (OOB) ──
  lines.push(`templ RenderPagination${JP}(result ListResult${JP}) {`);
  lines.push(`\t<div id="${config.paginationId}" hx-swap-oob="true" class="${TW.paginationBar}">`);
  // 表示件数セレクタ
  lines.push(`\t\t<div class="flex items-center gap-2 text-sm text-on-surface-variant">`);
  lines.push(`\t\t\t<span>表示件数:</span>`);
  lines.push(`\t\t\t<select name="size" hx-get="${apiPath}" hx-target="#${config.bodyTargetId}" hx-swap="innerHTML" hx-include="this" hx-vals='{"page": "1"}' class="bg-white rounded-md text-sm py-1 px-2 text-on-surface-variant border-none cursor-pointer outline-none focus:shadow-[0_0_0_1px_var(--color-primary)]">`);
  for (const s of [20, 50, 100]) {
    lines.push(`\t\t\t\t<option value="${s}" if result.PageSize == ${s} { selected }>${s}件</option>`);
  }
  lines.push(`\t\t\t</select>`);
  lines.push(`\t\t</div>`);
  // ページボタン
  lines.push(`\t\tif result.TotalPages > 1 {`);
  lines.push(`\t\t\t<div class="flex items-center gap-1">`);
  // 前へ
  lines.push(`\t\t\t\tif result.CurrentPage > 1 {`);
  lines.push(`\t\t\t\t\t<button class="${TW.inactivePageBtn}" hx-get={ fmt.Sprintf("${apiPath}?page=%d&size=%d", result.CurrentPage-1, result.PageSize) } hx-target="#${config.bodyTargetId}" hx-swap="innerHTML">&#8249;</button>`);
  lines.push(`\t\t\t\t} else {`);
  lines.push(`\t\t\t\t\t<span class="${TW.disabledPageBtn}">&#8249;</span>`);
  lines.push(`\t\t\t\t}`);
  // ページ番号
  lines.push(`\t\t\t\tfor i := 1; i <= result.TotalPages; i++ {`);
  lines.push(`\t\t\t\t\tif i == result.CurrentPage {`);
  lines.push(`\t\t\t\t\t\t<span class="${TW.activePageBtn}">{ fmt.Sprintf("%d", i) }</span>`);
  lines.push(`\t\t\t\t\t} else {`);
  lines.push(`\t\t\t\t\t\t<button class="${TW.inactivePageBtn}" hx-get={ fmt.Sprintf("${apiPath}?page=%d&size=%d", i, result.PageSize) } hx-target="#${config.bodyTargetId}" hx-swap="innerHTML">{ fmt.Sprintf("%d", i) }</button>`);
  lines.push(`\t\t\t\t\t}`);
  lines.push(`\t\t\t\t}`);
  // 次へ
  lines.push(`\t\t\t\tif result.CurrentPage < result.TotalPages {`);
  lines.push(`\t\t\t\t\t<button class="${TW.inactivePageBtn}" hx-get={ fmt.Sprintf("${apiPath}?page=%d&size=%d", result.CurrentPage+1, result.PageSize) } hx-target="#${config.bodyTargetId}" hx-swap="innerHTML">&#8250;</button>`);
  lines.push(`\t\t\t\t} else {`);
  lines.push(`\t\t\t\t\t<span class="${TW.disabledPageBtn}">&#8250;</span>`);
  lines.push(`\t\t\t\t}`);
  lines.push(`\t\t\t\t<span class="text-sm font-medium text-outline ml-4">{ fmt.Sprintf("%d", result.CurrentPage) } / { fmt.Sprintf("%d", result.TotalPages) } ページ</span>`);
  lines.push(`\t\t\t</div>`);
  lines.push(`\t\t} else {`);
  lines.push(`\t\t\t<div class="flex items-center gap-1">`);
  lines.push(`\t\t\t\t<span class="text-sm font-medium text-outline">全 { fmt.Sprintf("%d", result.TotalPages) } ページ</span>`);
  lines.push(`\t\t\t</div>`);
  lines.push(`\t\t}`);
  lines.push(`\t</div>`);
  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

function isNullableField(entity: EntityDef, key: string): boolean {
  const field = entity.fields.find((f) => f.name === key);
  return field ? !field.isNotNull : false;
}

function fieldExistsInEntity(entity: EntityDef, key: string): boolean {
  return entity.fields.some((f) => f.name === key);
}

function genRowCell(col: ColumnDef, entity: EntityDef): string {
  return genStyledRowCell(col, entity, { tdCell: "" });
}

function genStyledRowCell(col: ColumnDef, entity: EntityDef, TW: { tdCell: string }): string {
  const goField = toPascalCase(col.key);
  const cls = TW.tdCell ? ` class="${TW.tdCell}"` : "";
  if (!fieldExistsInEntity(entity, col.key) && col.key !== "_actions") {
    return `<td${cls}><!-- TODO: ${col.label} (${col.key}) — JOIN結果フィールドを Response に追加 --></td>`;
  }
  const nullable = isNullableField(entity, col.key);
  // barcode は nullable でも専用表示
  if (col.type === "barcode") {
    const valExpr = nullable ? `NullStrOr(item.${goField}, "")` : `item.${goField}`;
    const textExpr = nullable ? `NullStrOr(item.${goField}, "-")` : `item.${goField}`;
    return `<td${cls}><div class="flex flex-col gap-1">{ ${textExpr} }<react-barcode value={ ${valExpr} }></react-barcode></div></td>`;
  }
  if (nullable) {
    return `<td${cls}>{ NullStrOr(item.${goField}, "-") }</td>`;
  }
  switch (col.type) {
    case "number":
      return `<td${cls}>{ fmt.Sprintf("%d", item.${goField}) }</td>`;
    case "date":
      return `<td${cls}>{ item.${goField} }</td>`;
    case "select":
      return `<td${cls}>{ fmt.Sprintf("%v", item.${goField}) }</td>`;
    case "computed":
      return `<td${cls}>{ fmt.Sprintf("%d", item.${goField}) }</td>`;
    case "readonlyLookup":
      return `<td${cls}>{ item.${goField} }</td>`;
    case "itemCode":
      return `<td${cls}>{ item.${goField} }</td>`;
    default: // text
      return `<td${cls}>{ item.${goField} }</td>`;
  }
}

function genEditCell(col: ColumnDef, apiPath: string, idPrefix: string, entity: EntityDef): string {
  return genStyledEditCell(col, apiPath, idPrefix, entity, { tdCell: "", inputStyleSm: "" });
}

function genStyledEditCell(col: ColumnDef, apiPath: string, idPrefix: string, entity: EntityDef, TW: { tdCell: string; inputStyleSm: string }): string {
  const goField = toPascalCase(col.key);
  const cls = TW.tdCell ? ` class="${TW.tdCell}"` : "";
  const inputCls = TW.inputStyleSm ? ` class="${TW.inputStyleSm}"` : "";
  if (!fieldExistsInEntity(entity, col.key) && col.key !== "_actions") {
    return `<td${cls}>/* TODO: ${col.label} (${col.key}) */</td>`;
  }
  const nullable = isNullableField(entity, col.key);
  const valExpr = nullable ? `NullStrOr(item.${goField}, "")` : `item.${goField}`;
  switch (col.type) {
    case "number":
      return `<td${cls}><input type="number" name="${col.key}" value={ fmt.Sprintf("%d", item.${goField}) } form={ fmt.Sprintf("edit-form-%d", item.Id) }${inputCls}/></td>`;
    case "date":
      return `<td${cls}><input type="date" name="${col.key}" value={ item.${goField} } form={ fmt.Sprintf("edit-form-%d", item.Id) }${inputCls}/></td>`;
    case "select":
      return `<td${cls}>/* TODO: select ${col.label} */</td>`;
    case "computed":
      return `<td${cls}>{ fmt.Sprintf("%d", item.${goField}) }</td>`;
    case "readonlyLookup":
      return nullable ? `<td${cls}>{ NullStrOr(item.${goField}, "") }</td>` : `<td${cls}>{ item.${goField} }</td>`;
    case "barcode":
      return `<td${cls} x-data={ fmt.Sprintf("{ barcodeVal: '%s' }", ${valExpr}) }><input type="text" name="${col.key}" x-model="barcodeVal" form={ fmt.Sprintf("edit-form-%d", item.Id) }${inputCls}/><react-barcode x-bind:value="barcodeVal"></react-barcode></td>`;
    default: // text
      return `<td${cls}><input type="text" name="${col.key}" value={ ${valExpr} } form={ fmt.Sprintf("edit-form-%d", item.Id) }${inputCls}/></td>`;
  }
}

function genFormField(col: ColumnDef): string {
  return genStyledFormField(col, { labelStyle: "", inputStyle: "" });
}

function genStyledFormField(col: ColumnDef, TW: { labelStyle: string; inputStyle: string }): string {
  const lblCls = TW.labelStyle ? ` class="${TW.labelStyle}"` : "";
  const inputCls = TW.inputStyle ? ` class="${TW.inputStyle}"` : "";
  switch (col.type) {
    case "number":
      return `<label${lblCls}>${col.label}<input type="number" name="${col.key}" value="${col.defaultValue || "0"}"${col.min !== undefined ? ` min="${col.min}"` : ""}${col.required ? " required" : ""}${inputCls}/></label>`;
    case "date":
      return `<label${lblCls}>${col.label}<input type="date" name="${col.key}"${col.required ? " required" : ""}${inputCls}/></label>`;
    case "select":
      return `<label${lblCls}>${col.label}<select name="${col.key}"${col.required ? " required" : ""}${inputCls}>/* TODO: options */</select></label>`;
    case "barcode":
      return `<div x-data="{ barcodeVal: '' }"><label${lblCls}>${col.label}<input type="text" name="${col.key}" x-model="barcodeVal"${col.placeholder ? ` placeholder="${col.placeholder}"` : ""}${inputCls}/></label><div class="mt-2 flex justify-center"><react-barcode x-bind:value="barcodeVal"></react-barcode></div></div>`;
    case "itemCode":
      return `<label${lblCls}>${col.label}/* TODO: Typeahead品目 */</label>`;
    default: // text
      return `<label${lblCls}>${col.label}<input type="text" name="${col.key}"${col.required ? " required" : ""}${col.placeholder ? ` placeholder="${col.placeholder}"` : ""}${inputCls}/></label>`;
  }
}

// ─── manual_service.go (初回のみ) ─────────

function genManualService(fm: FeatureMapping): string {
  const JP = fm.jpName;
  return `package features

import (
\t"context"
\t"database/sql"
\t"net/http"
)

// ─── Validate (service_gen.go から呼ばれる) ───

func Validate登録${JP}(_ context.Context, _ *sql.DB, _ 作成Input${JP}) error {
\treturn nil
}

func Validate更新${JP}(_ context.Context, _ *sql.DB, _ 更新Input${JP}) error {
\treturn nil
}

// ─── Form パーサー (handler_gen.go から呼ばれる) ───

func Parse作成Form${JP}(r *http.Request) 作成Input${JP} {
\t// TODO: r.FormValue(...) で各フィールドをパース
\treturn 作成Input${JP}{}
}

func Parse更新Form${JP}(r *http.Request, id int) 更新Input${JP} {
\t// TODO: r.FormValue(...) で各フィールドをパース
\treturn 更新Input${JP}{ID: id}
}

`;
}

// ─── manual_sql.go (初回のみ) ──────────────

function genManualSQL(fm: FeatureMapping): string {
  const JP = fm.jpName;
  const table = fm.tableName;
  return `package features

import (
\t"context"
\t"database/sql"
\t"fmt"
\t"strings"
\t"time"
)

func Execute一覧SQL${JP}(ctx context.Context, db *sql.DB, input 一覧Input${JP}) (ListResult${JP}, error) {
\t_ = fmt.Sprintf
\t_ = strings.Join
\t_ = time.Now
\t// TODO: SELECT + COUNT + pagination
\treturn ListResult${JP}{}, nil
}

func Execute登録SQL${JP}(ctx context.Context, db *sql.DB, input 作成Input${JP}) (Response${JP}, error) {
\t_ = time.Now
\t// TODO: INSERT INTO ${table} ... RETURNING ...
\treturn Response${JP}{}, nil
}

func Execute更新SQL${JP}(ctx context.Context, db *sql.DB, input 更新Input${JP}) (Response${JP}, error) {
\t_ = time.Now
\t// TODO: UPDATE ${table} SET ... WHERE id=$1
\treturn Response${JP}{}, nil
}

func Execute削除SQL${JP}(ctx context.Context, db *sql.DB, input 削除Input${JP}) error {
\t_, err := db.ExecContext(ctx, \`DELETE FROM ${table} WHERE id=$1\`, input.ID)
\treturn err
}

func Execute一括削除SQL${JP}(ctx context.Context, db *sql.DB, input 一括削除Input${JP}) error {
\tif len(input.IDs) == 0 { return nil }
\tph := make([]string, len(input.IDs))
\targs := make([]any, len(input.IDs))
\tfor i, id := range input.IDs {
\t\tph[i] = fmt.Sprintf("$%d", i+1)
\t\targs[i] = id
\t}
\t_, err := db.ExecContext(ctx, fmt.Sprintf(\`DELETE FROM ${table} WHERE id IN (%s)\`, strings.Join(ph, ",")), args...)
\treturn err
}

func GetByIDSQL${JP}(ctx context.Context, db *sql.DB, id int) (Response${JP}, error) {
\t// TODO: SELECT FROM ${table} WHERE id=$1
\treturn Response${JP}{}, nil
}
`;
}

// ─── views/error_gen.templ ─────────────────

function genErrorTempl(): string {
  return `// Code generated by gen-go.ts. DO NOT EDIT.
package features

templ RenderErrorMessage(message string) {
\t<div style="color: #ba1a1a; font-size: 0.875rem; padding: 0.75rem; background: rgba(186,26,26,0.08); border-radius: 0.5rem; margin-bottom: 0.5rem;">
\t\t{ message }
\t</div>
}
`;
}

// ─── 共通ヘルパー: helpers_gen.go ──────────

function genHelpers(): string {
  return `// Code generated by gen-go.ts. DO NOT EDIT.
package features

import (
\t"database/sql"
\t"strconv"
)

// ParseIntSlice は文字列スライスを int スライスに変換する
func ParseIntSlice(ss []string) []int {
\tresult := make([]int, 0, len(ss))
\tfor _, s := range ss {
\t\tif v, err := strconv.Atoi(s); err == nil {
\t\t\tresult = append(result, v)
\t\t}
\t}
\treturn result
}

// NullStrOr は sql.NullString が有効なら文字列を、無効なら fallback を返す
func NullStrOr(ns sql.NullString, fallback string) string {
\tif ns.Valid {
\t\treturn ns.String
\t}
\treturn fallback
}
`;
}

// ─── Feature 生成メイン ────────────────────

function generateFeature(featureName: string): void {
  const fm = FEATURE_MAP[featureName];
  if (!fm) { console.error(`Unknown feature: ${featureName}`); return; }

  console.log(`\n=== ${featureName} (${fm.jpName}) ===`);

  const entities = parseSchemaFile();
  const entity = entities.get(fm.tableName);
  if (!entity) { console.error(`Table ${fm.tableName} not found`); return; }

  const configResult = parseConfigFile(featureName);
  const columns = configResult?.columns ?? [];
  const entityConfig = configResult?.entity ?? {
    idPrefix: "row", baseUrl: `/api/${featureName}`, bodyTargetId: "data-body",
    paginationId: "data-pagination", formTitle: `新規${featureName}登録`,
    emptyMessage: `${featureName}がありません`, deleteConfirmTemplate: "削除しますか？",
  };

  fs.mkdirSync(featuresDir, { recursive: true });

  const prefix = fm.jpName;
  const files: string[] = [];

  // _gen.* — 毎回上書き
  write(path.join(featuresDir, `${prefix}_types_gen.go`), genTypes(entity, fm), files);
  write(path.join(featuresDir, `${prefix}_service_gen.go`), genService(fm), files);
  write(path.join(featuresDir, `${prefix}_handler_gen.go`), genHandler(fm, entityConfig), files);
  write(path.join(featuresDir, `${prefix}_views_gen.templ`), genViewsTempl(entity, fm, columns, entityConfig), files);

  // _manual_* — 初回のみ
  writeOnce(path.join(featuresDir, `${prefix}_manual_service.go`), genManualService(fm), files);
  writeOnce(path.join(featuresDir, `${prefix}_manual_sql.go`), genManualSQL(fm), files);

  console.log("  files:");
  for (const f of files) console.log(`    ${path.relative(gothRoot, f)}`);
}

function write(p: string, content: string, files: string[]) {
  fs.writeFileSync(p, content);
  files.push(p);
}

function writeOnce(p: string, content: string, files: string[]) {
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, content);
    files.push(p);
  }
}

// ─── 実行 ──────────────────────────────

console.log("aha → GoTH コード生成 (再整備版)");
console.log(`features: ${featuresToGenerate.join(", ")}`);

// 共通
fs.mkdirSync(featuresDir, { recursive: true });
fs.writeFileSync(path.join(featuresDir, "error_gen.templ"), genErrorTempl());
fs.writeFileSync(path.join(featuresDir, "helpers_gen.go"), genHelpers());

for (const f of featuresToGenerate) generateFeature(f);

// レポート
console.log("\n=== レポート ===");
console.log("APIパス:");
for (const f of featuresToGenerate) {
  const fm = FEATURE_MAP[f];
  if (!fm) continue;
  const cfg = parseConfigFile(f);
  console.log(`  ${f}: ${cfg?.entity.baseUrl ?? `/api/${f}`}`);
}
console.log("\n命名例:");
console.log(`  型: Response品目, Row品目, Handler品目`);
console.log(`  関数: Get一覧品目, Execute登録品目`);
console.log(`  ファイル: 品目_types_gen.go`);
