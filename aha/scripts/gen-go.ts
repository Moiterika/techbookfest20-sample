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
 *   *_cus_*  → 初回のみ生成 (既存保護)
 *   router.go, main.go, ui/layout/, ui/components/ → 生成しない
 */

import * as path from "path";
import * as fs from "fs";

// ─── CLI ──────────────────────────────────

const args = process.argv.slice(2);
const allMode = args.includes("--all");
const featureIdx = args.indexOf("--feature");
const singleFeature = featureIdx >= 0 ? args[featureIdx + 1] : null;

const srcRoot = path.resolve("src");
const gothRoot = path.resolve("../goth");
const featuresDir = path.join(gothRoot, "internal/features");
// templ も features に同居 (import cycle 回避)

// ─── Feature 対応表（自動検出） ──────────────────

interface FeatureMapping {
  jpName: string; // 品目
  tableName: string; // items (DB)
  configExportPrefix: string; // 品目カラム, 品目エンティティ のプレフィックス
}

/** src/features/ 配下を走査し FeatureMapping を自動構築 */
function discoverFeatures(): Record<string, FeatureMapping> {
  const featuresRoot = path.join(srcRoot, "features");
  const skipDirs = new Set(["core", "shared"]);
  const dirs = fs.readdirSync(featuresRoot, { withFileTypes: true })
    .filter(d => d.isDirectory() && !skipDirs.has(d.name))
    .map(d => d.name);

  const map: Record<string, FeatureMapping> = {};
  for (const dirName of dirs) {
    const tableName = extractTableNameFromFeature(featuresRoot, dirName);
    if (!tableName) {
      console.warn(`  skip ${dirName}: tableName が見つかりません (config.ts or gen-go.config.ts)`);
      continue;
    }
    map[dirName] = {
      jpName: dirName,
      tableName,
      configExportPrefix: dirName,
    };
  }
  return map;
}

/** config.ts または gen-go.config.ts から tableName を抽出 */
function extractTableNameFromFeature(featuresRoot: string, dirName: string): string | null {
  // 1. config.ts を試す（EntityConfig の tableName フィールド）
  const configPath = path.join(featuresRoot, dirName, "config.ts");
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, "utf-8");
    const m = content.match(/tableName:\s*"([^"]*)"/);
    if (m) return m[1];
  }
  // 2. gen-go.config.ts を試す
  const genConfigPath = path.join(featuresRoot, dirName, "gen-go.config.ts");
  if (fs.existsSync(genConfigPath)) {
    const content = fs.readFileSync(genConfigPath, "utf-8");
    const m = content.match(/tableName\s*=\s*"([^"]*)"/);
    if (!m) {
      const m2 = content.match(/tableName:\s*"([^"]*)"/);
      if (m2) return m2[1];
    }
    if (m) return m[1];
  }
  return null;
}

const FEATURE_MAP = discoverFeatures();
const ALL_FEATURES = Object.keys(FEATURE_MAP);

// アイコンマニフェスト: gen-go.ts 実行中に収集、最後に JSON 出力 → bundle-static.ts が参照
const usedIcons = new Set<string>();

const featuresToGenerate = allMode
  ? [...ALL_FEATURES]
  : singleFeature
    ? [singleFeature]
    : ALL_FEATURES.length > 0
      ? [ALL_FEATURES[0]]
      : [];

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

interface SearchFieldDef {
  searchType: "text" | "date" | "select";
  param: string;
  label: string;
  placeholder: string;
  flexClass: string;
  dbColumns: string[];
  options: { value: string; label: string }[];
}

interface EntityConfigDef {
  idPrefix: string;
  baseUrl: string; // /api/品目 等 — 日本語
  bodyTargetId: string;
  paginationId: string;
  formTitle: string;
  emptyMessage: string;
  deleteConfirmTemplate: string;
  searchFields: SearchFieldDef[];
  searchContainerId: string;
}

// ─── Nav (Nav.astro から動的解析) ────────────────

interface NavItem {
  href: string;
  key: string;
  label: string;
}

function parseNavAstro(): NavItem[] {
  const navPath = path.join(srcRoot, "components/Nav.astro");
  if (!fs.existsSync(navPath)) return [];
  const content = fs.readFileSync(navPath, "utf-8");
  const items: NavItem[] = [];
  // マルチライン対応: <a> タグが複数行にまたがるケースを処理
  // まず <a ...>...</a> ブロックを全て抽出
  const aTagRegex = /<a\s[\s\S]*?<\/a\s*>/g;
  let aMatch;
  while ((aMatch = aTagRegex.exec(content)) !== null) {
    const tag = aMatch[0];
    const hrefMatch = tag.match(/href="([^"]+)"/);
    const keyMatch = tag.match(/current === "([^"]+)"/);
    // ラベル: >...< の最後のテキスト部分を取得
    const labelMatch = tag.match(/>([^<]+)<\/a/);
    if (hrefMatch && keyMatch && labelMatch) {
      items.push({
        href: hrefMatch[1],
        key: keyMatch[1],
        label: labelMatch[1].trim(),
      });
    }
  }
  return items;
}

const NAV_ITEMS = parseNavAstro();

// feature名 → navKey のマップを href から動的構築
// href="/品目" → feature "品目" → key "items"
const NAV_KEY_MAP: Record<string, string> = {};
for (const item of NAV_ITEMS) {
  if (item.href !== "/") {
    const featureName = item.href.replace(/^\//, "");
    NAV_KEY_MAP[featureName] = item.key;
  }
}

function navKey(featureName: string): string {
  return NAV_KEY_MAP[featureName] ?? featureName.toLowerCase();
}

/** nav_gen.templ を生成 */
function genNavTempl(): string {
  const lines: string[] = [];
  lines.push("// Code generated by gen-go.ts. DO NOT EDIT.");
  lines.push("package ui");
  lines.push("");
  lines.push(`var navClass = "flex gap-2 mb-6"`);
  lines.push(`var navLink = "text-sm py-2 px-4 rounded-lg font-semibold no-underline transition-all duration-200 text-primary hover:bg-surface-container-high"`);
  lines.push(`var navLinkActive = "text-sm py-2 px-4 rounded-lg font-semibold no-underline transition-all duration-200 bg-gradient-to-br from-primary to-primary-dark text-white pointer-events-none"`);
  lines.push("");
  lines.push("func navCls(current, key string) string {");
  lines.push("\tif current == key {");
  lines.push("\t\treturn navLinkActive");
  lines.push("\t}");
  lines.push("\treturn navLink");
  lines.push("}");
  lines.push("");
  lines.push("templ Nav(current string) {");
  lines.push(`\t<nav class={ navClass }>`);
  for (const item of NAV_ITEMS) {
    lines.push(`\t\t<a href="${item.href}" class={ navCls(current, "${item.key}") }>${item.label}</a>`);
  }
  lines.push(`\t</nav>`);
  lines.push("}");
  lines.push("");
  return lines.join("\n");
}

// ─── schema.ts パーサー ────────────────────

function parseSchemaFile(): Map<string, EntityDef> {
  const content = fs.readFileSync(path.join(srcRoot, "db/schema.ts"), "utf-8");
  const entities = new Map<string, EntityDef>();

  const tableStartRegex = /export const ([\w\u3000-\u9FFF\uFF00-\uFFEF]+) = pgTable\(\s*"([^"]+)",\s*\{/g;
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

    const m = trimmed.match(/^([\w\u3000-\u9FFF\uFF00-\uFFEF]+):\s*(serial|varchar|integer|numeric|timestamp|date)\("([^"]+)"[^)]*\)(.*)/);
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
    const col = parseColumnObject(obj, content);
    if (col) columns.push(col);
  }
  return columns;
}

function parseColumnObject(obj: string, fileContent?: string): ColumnDef | null {
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

  // options: リテラル配列をパース、変数参照も解決する
  const options: { value: string; label: string }[] = [];
  const optIdx = obj.indexOf("options:");
  if (optIdx >= 0) {
    const optBody = extractBracketContent(obj, optIdx);
    if (optBody) {
      const optRegex = /\{\s*value:\s*"([^"]*)",\s*label:\s*"([^"]*)"\s*\}/g;
      let optMatch;
      while ((optMatch = optRegex.exec(optBody)) !== null) {
        options.push({ value: optMatch[1], label: optMatch[2] });
      }
    }
    // インラインで見つからなかった場合、変数参照を解決
    if (options.length === 0 && fileContent) {
      const varRefMatch = obj.slice(optIdx).match(/options:\s*([A-Za-z_\u3000-\u9FFFぁ-んァ-ヶー]+)/);
      if (varRefMatch) {
        const varName = varRefMatch[1];
        const varDefRegex = new RegExp(`(?:const|let|var)\\s+${varName}\\s*=\\s*\\[([\\s\\S]*?)\\];`);
        const varDef = fileContent.match(varDefRegex);
        if (varDef) {
          const optRegex2 = /\{\s*value:\s*"([^"]*)",\s*label:\s*"([^"]*)"\s*\}/g;
          let m;
          while ((m = optRegex2.exec(varDef[1])) !== null) {
            options.push({ value: m[1], label: m[2] });
          }
        }
      }
    }
  }

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
  const idPrefix = extractFromConfig(content, "idPrefix") || "row";
  return {
    idPrefix,
    baseUrl: extractFromConfig(content, "baseUrl") || "/api/unknown",
    bodyTargetId: extractFromConfig(content, "bodyTargetId") || "data-body",
    paginationId: extractFromConfig(content, "paginationId") || "data-pagination",
    formTitle: extractFromConfig(content, "formTitle") || "新規登録",
    emptyMessage: extractFromConfig(content, "emptyMessage") || "データがありません",
    deleteConfirmTemplate: extractFromConfig(content, "deleteConfirmTemplate") || "削除しますか？",
    searchFields: parseSearchFields(content),
    searchContainerId: extractFromConfig(content, "searchContainerId") || `${idPrefix}-search`,
  };
}

/** 文字列リテラルを考慮した bracket depth matching */
function extractBracketContentStringSafe(s: string, offset: number, open = "[", close = "]"): string | null {
  let start = s.indexOf(open, offset);
  if (start < 0) return null;
  start++;
  let depth = 1;
  let inString = false;
  let strChar = "";
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (ch === "\\" ) { i++; continue; } // skip escaped
      if (ch === strChar) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { inString = true; strChar = ch; continue; }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return s.slice(start, i);
    }
  }
  return null;
}

/** searchFields 配列をパースする */
function parseSearchFields(content: string): SearchFieldDef[] {
  const fields: SearchFieldDef[] = [];
  const startIdx = content.indexOf("searchFields:");
  if (startIdx < 0) return fields;
  const body = extractBracketContentStringSafe(content, startIdx, "[", "]") || "";
  if (!body) return fields;

  // 各オブジェクトを balanced braces (string-safe) でパース
  let pos = 0;
  while (pos < body.length) {
    const objBody = extractBracketContentStringSafe(body, pos, "{", "}");
    if (objBody === null) break;
    // pos を進める
    const braceStart = body.indexOf("{", pos);
    pos = braceStart + objBody.length + 2; // skip { + body + }

    const searchType = extractString(objBody, "searchType") as "text" | "date" | "select" | null;
    const param = extractString(objBody, "param");
    const label = extractString(objBody, "label");
    if (!searchType || !param || !label) continue;

    // dbColumns をパース
    const dbColumns: string[] = [];
    const dbColIdx = objBody.indexOf("dbColumns:");
    if (dbColIdx >= 0) {
      const dbColBody = extractBracketContentStringSafe(objBody, dbColIdx, "[", "]");
      if (dbColBody) {
        const colStrRegex = /"([^"]*)"/g;
        let cm;
        while ((cm = colStrRegex.exec(dbColBody)) !== null) {
          dbColumns.push(cm[1]);
        }
      }
    }

    // options をパース (select 用)
    const options: { value: string; label: string }[] = [];
    const optIdx = objBody.indexOf("options:");
    if (optIdx >= 0) {
      const optBody = extractBracketContentStringSafe(objBody, optIdx, "[", "]");
      if (optBody) {
        const optRegex = /\{\s*value:\s*"([^"]*)",\s*label:\s*"([^"]*)"\s*\}/g;
        let om;
        while ((om = optRegex.exec(optBody)) !== null) {
          options.push({ value: om[1], label: om[2] });
        }
      }
    }

    fields.push({
      searchType,
      param,
      label,
      placeholder: extractString(objBody, "placeholder") || "",
      flexClass: extractString(objBody, "flexClass") || "",
      dbColumns,
      options,
    });
  }
  return fields;
}

function extractFromConfig(content: string, key: string): string | null {
  const m = content.match(new RegExp(`${key}:\\s*"([^"]*)"`));
  return m?.[1] ?? null;
}

// ─── ユーティリティ ────────────────────────

function toPascalCase(s: string): string {
  // 日本語を含む場合はそのまま返す（Go は Unicode 識別子をサポート）
  if (/[\u3000-\u9FFF\uFF00-\uFFEF]/.test(s)) return s;
  return s.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}

/** 親テーブルへの FK カラムかどうかを判定 */
function isParentFKColumn(f: FieldDef, parentTableName: string): boolean {
  // dbColumn が "親テーブル名_ID" or "親テーブル名_id" の形式
  const upper = f.dbColumn.toUpperCase();
  const parentUpper = parentTableName.toUpperCase();
  if (upper === `${parentUpper}_ID`) return true;
  // snake_case 形式: parent_table_id
  if (upper === `${parentUpper.replace(/ /g, "_")}_ID`) return true;
  return false;
}

/** SQL 識別子をダブルクォート（非 ASCII or 予約語の場合） */
function sqlQ(name: string): string {
  // id, created_at, updated_at 等の ASCII 識別子はクォート不要
  if (/^[a-z_][a-z0-9_]*$/.test(name)) return name;
  return `"${name}"`;
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

/** searchFields から一覧Input struct を生成 */
function gen一覧InputStruct(JP: string, searchFields?: SearchFieldDef[]): string {
  if (!searchFields || searchFields.length === 0) {
    return `type 一覧Input${JP} struct { Page int; Size int; Search string }`;
  }
  const fieldLines = searchFields.map((sf) => {
    const goFieldName = toPascalCase(sf.param);
    return `\t${goFieldName} string`;
  });
  return [
    `type 一覧Input${JP} struct {`,
    "\tPage int",
    "\tSize int",
    ...fieldLines,
    "}",
  ].join("\n");
}

/** param name から Go のフィールド初期化式を生成 */
function genSearchParamsParse(JP: string, searchFields?: SearchFieldDef[]): string[] {
  const lines: string[] = [];
  if (!searchFields || searchFields.length === 0) {
    lines.push(`\tsearch := r.URL.Query().Get("q")`);
    lines.push(`\tresult, err := h.Get一覧${JP}(r.Context(), 一覧Input${JP}{Page: page, Size: size, Search: search})`);
  } else {
    for (const sf of searchFields) {
      const goField = toPascalCase(sf.param);
      lines.push(`\t${sf.param}Param := r.URL.Query().Get("${sf.param}")`);
    }
    const fieldInits = searchFields.map((sf) => `${toPascalCase(sf.param)}: ${sf.param}Param`).join(", ");
    lines.push(`\tresult, err := h.Get一覧${JP}(r.Context(), 一覧Input${JP}{Page: page, Size: size, ${fieldInits}})`);
  }
  return lines;
}

// ─── Go コード生成: types_gen.go ───────────

function genTypes(entity: EntityDef, fm: FeatureMapping, searchFields?: SearchFieldDef[]): string {
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
  const inputFields = entity.fields.filter((f) => !f.isPrimaryKey && f.goType !== "time.Time");

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
  lines.push(gen一覧InputStruct(JP, searchFields));
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

  // 各メソッド — dao_gen.go の関数を呼ぶ
  const ops = [
    { method: `Get一覧${JP}`, sig: `(ctx context.Context, input 一覧Input${JP}) (ListResult${JP}, error)`, call: `Execute一覧SQL${JP}(ctx, h.DB, input)` },
    { method: `Execute登録${JP}`, sig: `(ctx context.Context, input 作成Input${JP}) (Response${JP}, error)`, call: `Execute登録SQL${JP}(ctx, h.DB, input)`, validate: true },
    { method: `Execute更新${JP}`, sig: `(ctx context.Context, input 更新Input${JP}) (Response${JP}, error)`, call: `Execute更新SQL${JP}(ctx, h.DB, input)`, validate: true },
    { method: `Execute削除${JP}`, sig: `(ctx context.Context, input 削除Input${JP}) error`, call: `Execute削除SQL${JP}(ctx, h.DB, input)` },
    { method: `Execute一括削除${JP}`, sig: `(ctx context.Context, input 一括削除Input${JP}) error`, call: `Execute一括削除SQL${JP}(ctx, h.DB, input)` },
    { method: `GetByID${JP}`, sig: `(ctx context.Context, id int) (Response${JP}, error)`, call: `GetByIDSQL${JP}(ctx, h.DB, id)` },
    { method: `GetExport${JP}`, sig: `(ctx context.Context, input 一覧Input${JP}) ([]Response${JP}, error)`, call: `ExecuteExportSQL${JP}(ctx, h.DB, input)` },
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

function genHandler(fm: FeatureMapping, config: EntityConfigDef | null, columns: ColumnDef[] = [], entity?: EntityDef): string {
  const JP = fm.jpName;
  const apiPath = config?.baseUrl ?? `/api/${fm.jpName}`;

  const lines: string[] = [];
  lines.push("// Code generated by gen-go.ts. DO NOT EDIT.");
  lines.push("package features");
  lines.push("");
  lines.push('import (\n\t"encoding/csv"\n\t"fmt"\n\t"net/http"\n\t"strconv"\n\t"time"\n)');
  lines.push("");

  // RegisterRoutes
  lines.push(`func (h *Handler${JP}) RegisterRoutes${JP}(mux *http.ServeMux) {`);
  lines.push(`\tmux.HandleFunc("GET /${JP}", h.HandlePage${JP})`);
  lines.push(`\tmux.HandleFunc("GET ${apiPath}", h.Handle一覧${JP})`);
  lines.push(`\tmux.HandleFunc("GET ${apiPath}/export", h.HandleExport${JP})`);
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
  for (const l of genSearchParamsParse(JP, config?.searchFields)) {
    lines.push(l);
  }
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
  lines.push(`\tform, err := ParseDeleteForm(r)`);
  lines.push("\tif err != nil {");
  lines.push(`\t\thttp.Error(w, "Bad request", http.StatusBadRequest)`);
  lines.push("\t\treturn");
  lines.push("\t}");
  lines.push(`\tids := ParseIntSlice(form["ids[]"])`);
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
  // ── アイコン参照 (SVG本体は bundle-static.ts → icons_gen.templ で生成) ──
  // templ 内では @ui.Icon("icon-name", "css-class") で参照
  // usedIcons はモジュールレベルで定義

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
    editBtn: "inline-flex items-center gap-1 text-primary text-xs font-bold px-2 py-1 rounded-md cursor-pointer border-none bg-transparent no-underline hover:bg-primary/10",
    kebabBtn: "inline-flex items-center justify-center w-7 h-7 rounded-full cursor-pointer text-outline border-none bg-transparent hover:text-on-surface hover:bg-surface-container-low",
    kebabMenu: "absolute right-0 top-full z-20 mt-1 bg-white rounded-lg shadow-[0_10px_30px_-5px_rgba(18,28,42,0.08)] py-1 min-w-[120px]",
    kebabItem: "flex items-center gap-2 w-full text-left px-3 py-2 text-sm cursor-pointer text-error border-none bg-transparent hover:bg-error-container/30",
    dropdownMenu: "absolute z-10 mt-1 bg-white rounded-lg shadow-[0_10px_30px_-5px_rgba(18,28,42,0.08)] py-1 min-w-[120px]",
    dropdownItem: "block w-full text-left px-3 py-1.5 text-sm cursor-pointer border-none bg-transparent hover:bg-surface-container-low",
    card: "mb-6 p-6 rounded-xl bg-white",
    cardTitle: "text-lg font-bold text-on-surface mb-4 tracking-tight",
    pageContainer: "max-w-[87.5rem] mx-auto py-8 px-8",
    pageTitle: "text-2xl font-bold mb-8 text-on-surface tracking-tight",
    paginationBar: "flex justify-between items-center py-4 px-6 bg-surface-container-low rounded-b-xl flex-wrap gap-3",
    activePageBtn: "w-8 h-8 flex items-center justify-center text-xs font-bold rounded-lg bg-gradient-to-br from-primary to-primary-dark text-white cursor-default border-none",
    inactivePageBtn: "w-8 h-8 flex items-center justify-center text-xs font-bold rounded-lg cursor-pointer text-on-surface hover:bg-surface-container-high border-none",
    disabledPageBtn: "w-8 h-8 flex items-center justify-center text-xs rounded-lg text-outline-variant cursor-default border-none",
  };

  // 検索フィールド — config.searchFields があればそれを使い、なければテキスト列から自動生成
  const searchFields = config.searchFields;
  const searchContainerId = config.searchContainerId || `${JP}-search`;

  // フォールバック用: searchFields が空の場合に旧方式の単一検索フィールドを生成
  let fallbackSearchPlaceholder = "";
  if (searchFields.length === 0) {
    const textLabels = dataCols.filter((c) => c.type === "text" || c.type === undefined).map((c) => c.label).slice(0, 2);
    fallbackSearchPlaceholder = textLabels.length > 0 ? `${textLabels.join("・")}で検索…` : "検索…";
  }

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
  lines.push(`\t\t\t@ui.Nav("${navKey(JP)}")`);
  lines.push(`\t\t\t<h1 class="${TW.pageTitle}">${JP}管理</h1>`);
  // 検索パネル
  lines.push(`\t\t\t<div id="${searchContainerId}" class="${TW.card}">`);
  lines.push(`\t\t\t\t<div class="flex gap-4 flex-wrap">`);
  if (searchFields.length > 0) {
    for (const sf of searchFields) {
      const flexCls = sf.flexClass ? ` ${sf.flexClass}` : "";
      const trigger = sf.searchType === "text" ? "input changed delay:300ms, search" : "change";
      const inputType = sf.searchType === "date" ? "date" : "search";
      if (sf.searchType === "select") {
        lines.push(`\t\t\t\t\t<div class="${TW.labelStyle}${flexCls}">`);
        lines.push(`\t\t\t\t\t\t<span>${sf.label}</span>`);
        lines.push(`\t\t\t\t\t\t<select name="${sf.param}" class="${TW.inputStyle}" hx-get="${apiPath}" hx-trigger="change" hx-target="#${config.bodyTargetId}" hx-swap="innerHTML" hx-include="#${searchContainerId}" hx-vals='{"page": "1"}'>`);
        lines.push(`\t\t\t\t\t\t\t<option value="">すべて</option>`);
        for (const opt of sf.options) {
          lines.push(`\t\t\t\t\t\t\t<option value="${opt.value}">${opt.label}</option>`);
        }
        lines.push(`\t\t\t\t\t\t</select>`);
        lines.push(`\t\t\t\t\t</div>`);
      } else {
        lines.push(`\t\t\t\t\t<div class="${TW.labelStyle}${flexCls}">`);
        lines.push(`\t\t\t\t\t\t<span>${sf.label}</span>`);
        lines.push(`\t\t\t\t\t\t<input type="${inputType}" name="${sf.param}" placeholder="${sf.placeholder}" class="${TW.inputStyle}" hx-get="${apiPath}" hx-trigger="${trigger}" hx-target="#${config.bodyTargetId}" hx-swap="innerHTML" hx-include="#${searchContainerId}" hx-vals='{"page": "1"}'/>`);
        lines.push(`\t\t\t\t\t</div>`);
      }
    }
  } else {
    lines.push(`\t\t\t\t\t<div class="${TW.labelStyle} flex-1 min-w-[12.5rem]">`);
    lines.push(`\t\t\t\t\t\t<span>検索</span>`);
    lines.push(`\t\t\t\t\t\t<input type="search" name="q" placeholder="${fallbackSearchPlaceholder}" class="${TW.inputStyle}" hx-get="${apiPath}" hx-trigger="input changed delay:300ms, search" hx-target="#${config.bodyTargetId}" hx-swap="innerHTML" hx-include="#${searchContainerId}" hx-vals='{"page": "1"}'/>`);
    lines.push(`\t\t\t\t\t</div>`);
  }
  lines.push(`\t\t\t\t</div>`);
  lines.push(`\t\t\t</div>`);
  // ツールバー + フォーム
  lines.push(`\t\t\t<div x-data="{ open: false }">`);
  // ツールバー
  lines.push(`\t\t\t\t<div class="flex justify-between items-center mb-6 flex-wrap gap-4" x-data="{ hasSelection: false, updateSelection() { const tbody = document.getElementById('${config.bodyTargetId}'); this.hasSelection = tbody ? tbody.querySelectorAll('input[name=\\'rowSelect\\']:checked').length > 0 : false; } }" @change.window="updateSelection()" @htmx--after-swap.window="$nextTick(() => updateSelection())">`);
  lines.push(`\t\t\t\t\t<div class="flex items-center gap-3 flex-wrap">`);
  usedIcons.add("clipboard-document"); usedIcons.add("trash");
  lines.push(`\t\t\t\t\t\t<button class="${TW.ghostBtn}" data-bulk-copy data-body-target="${config.bodyTargetId}" :disabled="!hasSelection">`);
  lines.push(`\t\t\t\t\t\t\t@ui.Icon("clipboard-document", "w-4.5 h-4.5")`);
  lines.push(`\t\t\t\t\t\t\t選択コピー`);
  lines.push(`\t\t\t\t\t\t</button>`);
  lines.push(`\t\t\t\t\t\t<button class="${TW.ghostBtnDanger}" data-bulk-delete="${apiPath}" data-body-target="${config.bodyTargetId}" :disabled="!hasSelection">`);
  lines.push(`\t\t\t\t\t\t\t@ui.Icon("trash", "w-4.5 h-4.5")`);
  lines.push(`\t\t\t\t\t\t\t選択削除`);
  lines.push(`\t\t\t\t\t\t</button>`);
  lines.push(`\t\t\t\t\t</div>`);
  lines.push(`\t\t\t\t\t<div class="flex items-center gap-3 flex-wrap">`);
  // ダウンロードドロップダウン
  lines.push(`\t\t\t\t\t\t<div class="relative" x-data="{ dlOpen: false }" @click.outside="dlOpen = false">`);
  usedIcons.add("arrow-down-tray");
  lines.push(`\t\t\t\t\t\t\t<button class="${TW.ghostBtn}" @click="dlOpen = !dlOpen">`);
  lines.push(`\t\t\t\t\t\t\t\t@ui.Icon("arrow-down-tray", "w-4.5 h-4.5")`);
  lines.push(`\t\t\t\t\t\t\t\tダウンロード`);
  lines.push(`\t\t\t\t\t\t\t</button>`);
  lines.push(`\t\t\t\t\t\t\t<div class="${TW.dropdownMenu}" x-show="dlOpen" x-transition x-cloak>`);
  lines.push(`\t\t\t\t\t\t\t\t<button class="${TW.dropdownItem}" @click="window.__crudExport('${apiPath}', 'csv', '${searchContainerId}'); dlOpen = false">CSV</button>`);
  lines.push(`\t\t\t\t\t\t\t\t<button class="${TW.dropdownItem}" @click="window.__crudExport('${apiPath}', 'tsv', '${searchContainerId}'); dlOpen = false">TSV</button>`);
  lines.push(`\t\t\t\t\t\t\t\t<button class="${TW.dropdownItem}" @click="window.__crudExport('${apiPath}', 'xlsx', '${searchContainerId}'); dlOpen = false">Excel (xlsx)</button>`);
  lines.push(`\t\t\t\t\t\t\t</div>`);
  lines.push(`\t\t\t\t\t\t</div>`);
  usedIcons.add("arrow-path");
  lines.push(`\t\t\t\t\t\t<button class="${TW.ghostBtn}" hx-get="${apiPath}" hx-target="#${config.bodyTargetId}" hx-swap="innerHTML">`);
  lines.push(`\t\t\t\t\t\t\t@ui.Icon("arrow-path", "w-4.5 h-4.5")`);
  lines.push(`\t\t\t\t\t\t\t更新`);
  lines.push(`\t\t\t\t\t\t</button>`);
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
  // 操作列 (編集ボタン + ケバブメニュー内削除)
  lines.push(`\t\t<td class="py-4 px-6 text-right">`);
  lines.push(`\t\t\t<div class="flex items-center justify-end gap-2">`);
  usedIcons.add("pencil-square"); usedIcons.add("ellipsis-vertical-solid"); usedIcons.add("trash");
  lines.push(`\t\t\t\t<button class="${TW.editBtn}" hx-get={ fmt.Sprintf("${apiPath}/%d/edit", item.Id) } hx-target={ fmt.Sprintf("#${config.idPrefix}-%d", item.Id) } hx-swap="outerHTML">`);
  lines.push(`\t\t\t\t\t@ui.Icon("pencil-square", "w-3.5 h-3.5")`);
  lines.push(`\t\t\t\t\t編集`);
  lines.push(`\t\t\t\t</button>`);
  lines.push(`\t\t\t\t<div class="relative" x-data="{ menuOpen: false }" @click.outside="menuOpen = false">`);
  lines.push(`\t\t\t\t\t<button class="${TW.kebabBtn}" @click="menuOpen = !menuOpen" type="button">`);
  lines.push(`\t\t\t\t\t\t@ui.Icon("ellipsis-vertical-solid", "w-5 h-5")`);
  lines.push(`\t\t\t\t\t</button>`);
  lines.push(`\t\t\t\t\t<div class="${TW.kebabMenu}" x-show="menuOpen" x-transition x-cloak>`);
  lines.push(`\t\t\t\t\t\t<button class="${TW.kebabItem}" hx-delete={ fmt.Sprintf("${apiPath}/%d", item.Id) } hx-target={ fmt.Sprintf("#${config.idPrefix}-%d", item.Id) } hx-swap="outerHTML swap:0.3s" hx-confirm="${config.deleteConfirmTemplate}" @click="menuOpen = false">`);
  lines.push(`\t\t\t\t\t\t\t@ui.Icon("trash", "w-4 h-4")`);
  lines.push(`\t\t\t\t\t\t\t削除`);
  lines.push(`\t\t\t\t\t\t</button>`);
  lines.push(`\t\t\t\t\t</div>`);
  lines.push(`\t\t\t\t</div>`);
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
  // barcode: 値がある場合のみ表示（aha CrudRow と同じ）
  if (col.type === "barcode") {
    if (nullable) {
      return `<td${cls}>if item.${goField}.Valid {\n\t\t\t<react-barcode value={ item.${goField}.String }></react-barcode>\n\t\t}</td>`;
    }
    return `<td${cls}>if item.${goField} != "" {\n\t\t\t<react-barcode value={ item.${goField} }></react-barcode>\n\t\t}</td>`;
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
    case "select": {
      const opts = (col.options || []).map(o =>
        `<option value="${o.value}" if fmt.Sprintf("%v", item.${goField}) == "${o.value}" { selected }>${o.label}</option>`
      ).join("");
      return `<td${cls}><select name="${col.key}" form={ fmt.Sprintf("edit-form-%d", item.Id) }${inputCls}>${opts}</select></td>`;
    }
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
    case "select": {
      const opts = (col.options || []).map(o => `<option value="${o.value}">${o.label}</option>`).join("");
      return `<label${lblCls}>${col.label}<select name="${col.key}"${col.required ? " required" : ""}${inputCls}>${opts}</select></label>`;
    }
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
\t"net/http"

\t"database/sql"
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
  const table = sqlQ(fm.tableName);
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
\t// TODO: SELECT + COUNT + pagination from ${table}
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
\t"fmt"
\t"io"
\t"net/http"
\t"net/url"
\t"strconv"

\t"github.com/xuri/excelize/v2"
)

var _ = fmt.Sprintf

// ParseDeleteForm は DELETE リクエストのボディをパースする。
// Go の ParseForm は DELETE メソッドのボディを読まないため手動でパースする。
func ParseDeleteForm(r *http.Request) (url.Values, error) {
\tbody, err := io.ReadAll(r.Body)
\tif err != nil {
\t\treturn nil, err
\t}
\tdefer r.Body.Close()
\treturn url.ParseQuery(string(body))
}

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

// toNullString は *string を sql.NullString に変換する
func toNullString(s *string) sql.NullString {
\tif s == nil || *s == "" {
\t\treturn sql.NullString{}
\t}
\treturn sql.NullString{String: *s, Valid: true}
}

// WriteXLSX はヘッダーと行データからXLSXを生成し、ResponseWriter に書き出す
func WriteXLSX(w http.ResponseWriter, filename string, headers []string, rows [][]string) error {
\tf := excelize.NewFile()
\tdefer f.Close()
\tsheet := "Sheet1"
\tfor i, h := range headers {
\t\tcell, _ := excelize.CoordinatesToCellName(i+1, 1)
\t\tf.SetCellValue(sheet, cell, h)
\t}
\tfor r, row := range rows {
\t\tfor c, val := range row {
\t\t\tcell, _ := excelize.CoordinatesToCellName(c+1, r+2)
\t\t\tf.SetCellValue(sheet, cell, val)
\t\t}
\t}
\tw.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
\tw.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\\\"%s\\\"", filename))
\treturn f.Write(w)
}
`;
}

// ─── Header-Body 設定パーサー ─────────────────

interface HeaderBodyChildDef {
  tableName: string;
  sectionLabel: string;
  discriminatorColumn?: string;
  discriminatorValue?: string;
  columns: ColumnDef[];
}

interface HeaderBodyDef {
  headerColumns: ColumnDef[];
  children: HeaderBodyChildDef[];
  entityConfig: EntityConfigDef;
}

/** gen-go.config.ts から header-body 設定を抽出 */
function parseHeaderBodyConfig(featureName: string): HeaderBodyDef | null {
  const configPath = path.join(srcRoot, `features/${featureName}/gen-go.config.ts`);
  if (!fs.existsSync(configPath)) return null;
  const content = fs.readFileSync(configPath, "utf-8");

  // type: "header-body" が存在するか
  if (!content.includes('"header-body"')) return null;

  // EntityConfig 部分を抽出
  const idPrefix = extractFromConfig(content, "idPrefix") || "row";
  const entityConfig: EntityConfigDef = {
    idPrefix,
    baseUrl: extractFromConfig(content, "baseUrl") || `/api/${featureName}`,
    bodyTargetId: extractFromConfig(content, "bodyTargetId") || "data-body",
    paginationId: extractFromConfig(content, "paginationId") || "data-pagination",
    formTitle: extractFromConfig(content, "formTitle") || `新規${featureName}登録`,
    emptyMessage: extractFromConfig(content, "emptyMessage") || `${featureName}がありません`,
    deleteConfirmTemplate: extractFromConfig(content, "deleteConfirmTemplate") || "削除しますか？",
    searchFields: parseSearchFields(content),
    searchContainerId: extractFromConfig(content, "searchContainerId") || `${idPrefix}-search`,
  };

  // headerColumns を抽出
  const headerColumnsMatch = content.match(/headerColumns:\s*\[([\s\S]*?)\],\s*children:/);
  const headerColumns: ColumnDef[] = [];
  if (headerColumnsMatch) {
    const body = headerColumnsMatch[1];
    const objRegex = /\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
    let objMatch;
    while ((objMatch = objRegex.exec(body)) !== null) {
      const col = parseColumnObject(objMatch[1]);
      if (col) headerColumns.push(col);
    }
  }

  // children を抽出
  const children: HeaderBodyChildDef[] = [];
  const childrenMatch = content.match(/children:\s*\[([\s\S]*)\]\s*[,;]?\s*\}\s*;?\s*$/);
  if (childrenMatch) {
    // 各 { ... } オブジェクトを抽出（ネスト対応）
    const childrenBody = childrenMatch[1];
    const childBlocks = extractTopLevelObjects(childrenBody);
    for (const block of childBlocks) {
      const childTableName = extractString(block, "tableName");
      const sectionLabel = extractString(block, "sectionLabel");
      if (!childTableName || !sectionLabel) continue;

      // discriminator
      const discMatch = block.match(/discriminator:\s*\{([^}]*)\}/);
      let discriminatorColumn: string | undefined;
      let discriminatorValue: string | undefined;
      if (discMatch) {
        discriminatorColumn = extractString(discMatch[1], "column") || undefined;
        const numVal = extractNumber(discMatch[1], "value");
        const strVal = extractString(discMatch[1], "value");
        discriminatorValue = numVal || strVal || undefined;
      }

      // child columns — ネスト対応でブラケットを追跡
      const childCols: ColumnDef[] = [];
      const colsStart = block.indexOf("columns:");
      if (colsStart >= 0) {
        const colsBody = extractBracketContent(block, colsStart);
        if (colsBody) {
          // 各カラムオブジェクトを抽出（ネスト対応）
          const colBlocks = extractTopLevelObjects(colsBody);
          for (const cb of colBlocks) {
            const col = parseColumnObject(cb);
            if (col) childCols.push(col);
          }
        }
      }

      children.push({
        tableName: childTableName,
        sectionLabel,
        discriminatorColumn,
        discriminatorValue,
        columns: childCols,
      });
    }
  }

  return { headerColumns, children, entityConfig };
}

/** 最上位レベルの {} ブロックを抽出（ネスト対応） */
function extractTopLevelObjects(s: string): string[] {
  const results: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "{") {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (s[i] === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        results.push(s.slice(start, i));
        start = -1;
      }
    }
  }
  return results;
}

/** offset 以降の最初の `[` から対応する `]` までの中身を返す（ネスト対応） */
function extractBracketContent(s: string, offset: number): string | null {
  let start = s.indexOf("[", offset);
  if (start < 0) return null;
  start++;
  let depth = 1;
  for (let i = start; i < s.length; i++) {
    if (s[i] === "[") depth++;
    else if (s[i] === "]") {
      depth--;
      if (depth === 0) return s.slice(start, i);
    }
  }
  return null;
}

// ─── Header-Body Go コード生成 ────────────────

function genHeaderBodyTypes(parentEntity: EntityDef, childEntities: Map<string, EntityDef>, fm: FeatureMapping, hbDef: HeaderBodyDef): string {
  const JP = fm.jpName;
  const lines: string[] = [];

  lines.push("// Code generated by gen-go.ts. DO NOT EDIT.");
  lines.push("package features");
  lines.push("");

  // imports
  const allFields = [
    ...parentEntity.fields,
    ...[...childEntities.values()].flatMap((e) => e.fields),
  ];
  const hasSqlNull = allFields.some((f) => f.goType.startsWith("sql."));
  const hasTime = allFields.some((f) => f.goType === "time.Time");
  if (hasSqlNull || hasTime) {
    lines.push("import (");
    if (hasSqlNull) lines.push('\t"database/sql"');
    if (hasTime) lines.push('\t"time"');
    lines.push(")");
    lines.push("");
  }

  // Parent Row
  lines.push(`// Row${JP} は ${parentEntity.tableName} テーブルの行`);
  lines.push(`type Row${JP} struct {`);
  for (const f of parentEntity.fields) {
    lines.push(`\t${f.goName} ${f.goType} \`db:"${f.dbColumn}"\``);
  }
  lines.push("}");
  lines.push("");

  // Child Row types (deduplicated by table name)
  // itemCode 列があれば JOIN 用フィールドを追加
  const childTablesSeen = new Set<string>();
  const childHasItemCode = new Set<string>();
  for (const child of hbDef.children) {
    if (child.columns.some((c: ColumnDef) => c.type === "itemCode")) {
      childHasItemCode.add(child.tableName);
    }
  }
  for (const child of hbDef.children) {
    if (childTablesSeen.has(child.tableName)) continue;
    childTablesSeen.add(child.tableName);
    const childEntity = childEntities.get(child.tableName);
    if (!childEntity) continue;
    const childStruct = toPascalCase(child.tableName);
    lines.push(`// ${childStruct} は ${child.tableName} テーブルの行`);
    lines.push(`type ${childStruct} struct {`);
    for (const f of childEntity.fields) {
      lines.push(`\t${f.goName} ${f.goType} \`db:"${f.dbColumn}"\``);
    }
    if (childHasItemCode.has(child.tableName)) {
      lines.push(`\t// JOIN 結果`);
      lines.push(`\t品目コード string`);
      lines.push(`\t品目名 string`);
    }
    lines.push("}");
    lines.push("");
  }

  // Parent Input structs
  const parentInputFields = parentEntity.fields.filter((f) => !f.isPrimaryKey && f.goType !== "time.Time");

  lines.push(`type 作成Input${JP} struct {`);
  for (const f of parentInputFields) {
    lines.push(`\t${f.goName} ${f.isNotNull ? simpleGoType(f.goType) : `*${simpleGoType(f.goType)}`}`);
  }
  // Add Lines field for each unique child table
  childTablesSeen.clear();
  for (const child of hbDef.children) {
    if (childTablesSeen.has(child.tableName)) continue;
    childTablesSeen.add(child.tableName);
    const childStruct = toPascalCase(child.tableName);
    const childEntity = childEntities.get(child.tableName);
    if (!childEntity) continue;
    // 親テーブルへの FK カラムを除外（dbColumn に親テーブル名を含む or _ID/_id で終わる参照列）
    const parentTable = parentEntity.tableName;
    const childInputFields = childEntity.fields.filter(
      (f) => !f.isPrimaryKey && f.goType !== "time.Time" && !isParentFKColumn(f, parentTable),
    );
    // Generate a child input struct
    lines.push("}");
    lines.push("");
    lines.push(`type 作成Input${childStruct} struct {`);
    for (const f of childInputFields) {
      lines.push(`\t${f.goName} ${f.isNotNull ? simpleGoType(f.goType) : `*${simpleGoType(f.goType)}`}`);
    }
  }
  lines.push("}");
  lines.push("");

  // Composite create input with lines
  lines.push(`type 作成Input${JP}WithLines struct {`);
  lines.push(`\t作成Input${JP}`);
  childTablesSeen.clear();
  for (const child of hbDef.children) {
    if (childTablesSeen.has(child.tableName)) continue;
    childTablesSeen.add(child.tableName);
    const childStruct = toPascalCase(child.tableName);
    lines.push(`\tLines${childStruct} []作成Input${childStruct}`);
  }
  lines.push("}");
  lines.push("");

  // Update input
  lines.push(`type 更新Input${JP} struct {`);
  lines.push("\tID int");
  for (const f of parentInputFields) {
    lines.push(`\t${f.goName} ${f.isNotNull ? simpleGoType(f.goType) : `*${simpleGoType(f.goType)}`}`);
  }
  lines.push("}");
  lines.push("");

  lines.push(`type 更新Input${JP}WithLines struct {`);
  lines.push(`\t更新Input${JP}`);
  childTablesSeen.clear();
  for (const child of hbDef.children) {
    if (childTablesSeen.has(child.tableName)) continue;
    childTablesSeen.add(child.tableName);
    const childStruct = toPascalCase(child.tableName);
    lines.push(`\tLines${childStruct} []作成Input${childStruct}`);
  }
  lines.push("}");
  lines.push("");

  lines.push(`type 削除Input${JP} struct { ID int }`);
  lines.push(`type 一括削除Input${JP} struct { IDs []int }`);
  lines.push(gen一覧InputStruct(JP, hbDef.entityConfig.searchFields));
  lines.push("");

  // Response types
  lines.push(`type Response${JP} struct { Row${JP} }`);
  lines.push("");

  // Detail response with children
  lines.push(`type Response${JP}詳細 struct {`);
  lines.push(`\tRow${JP}`);
  for (const child of hbDef.children) {
    const childStruct = toPascalCase(child.tableName);
    const fieldName = child.discriminatorValue
      ? `${child.sectionLabel.replace(/[（）\(\)]/g, "").replace(/\s/g, "")}`
      : `Lines`;
    lines.push(`\t${fieldName} []${childStruct}`);
  }
  lines.push("}");
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

function genHeaderBodyService(fm: FeatureMapping, hbDef: HeaderBodyDef): string {
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

  // 一覧
  lines.push(`func (h *Handler${JP}) Get一覧${JP}(ctx context.Context, input 一覧Input${JP}) (ListResult${JP}, error) {`);
  lines.push(`\treturn Execute一覧SQL${JP}(ctx, h.DB, input)`);
  lines.push("}");
  lines.push("");

  // 詳細取得
  lines.push(`func (h *Handler${JP}) GetByID${JP}詳細(ctx context.Context, id int) (Response${JP}詳細, error) {`);
  lines.push(`\treturn GetByID${JP}詳細SQL(ctx, h.DB, id)`);
  lines.push("}");
  lines.push("");

  // 登録
  lines.push(`func (h *Handler${JP}) Execute登録${JP}(ctx context.Context, input 作成Input${JP}WithLines) (Response${JP}, error) {`);
  lines.push(`\tif err := Validate登録${JP}(ctx, h.DB, input); err != nil {`);
  lines.push(`\t\treturn Response${JP}{}, err`);
  lines.push("\t}");
  lines.push(`\treturn Execute登録SQL${JP}(ctx, h.DB, input)`);
  lines.push("}");
  lines.push("");

  // 更新
  lines.push(`func (h *Handler${JP}) Execute更新${JP}(ctx context.Context, input 更新Input${JP}WithLines) (Response${JP}, error) {`);
  lines.push(`\tif err := Validate更新${JP}(ctx, h.DB, input); err != nil {`);
  lines.push(`\t\treturn Response${JP}{}, err`);
  lines.push("\t}");
  lines.push(`\treturn Execute更新SQL${JP}(ctx, h.DB, input)`);
  lines.push("}");
  lines.push("");

  // 削除
  lines.push(`func (h *Handler${JP}) Execute削除${JP}(ctx context.Context, input 削除Input${JP}) error {`);
  lines.push(`\treturn Execute削除SQL${JP}(ctx, h.DB, input)`);
  lines.push("}");
  lines.push("");

  // 一括削除
  lines.push(`func (h *Handler${JP}) Execute一括削除${JP}(ctx context.Context, input 一括削除Input${JP}) error {`);
  lines.push(`\treturn Execute一括削除SQL${JP}(ctx, h.DB, input)`);
  lines.push("}");
  lines.push("");

  // エクスポート
  lines.push(`func (h *Handler${JP}) GetExport${JP}(ctx context.Context, input 一覧Input${JP}) ([]Response${JP}, error) {`);
  lines.push(`\treturn ExecuteExportSQL${JP}(ctx, h.DB, input)`);
  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

function genHeaderBodyHandler(fm: FeatureMapping, config: EntityConfigDef, headerColumns: ColumnDef[] = [], entity?: EntityDef): string {
  const JP = fm.jpName;
  const apiPath = config.baseUrl;

  const lines: string[] = [];
  lines.push("// Code generated by gen-go.ts. DO NOT EDIT.");
  lines.push("package features");
  lines.push("");
  lines.push('import (\n\t"encoding/csv"\n\t"fmt"\n\t"net/http"\n\t"strconv"\n\t"time"\n)');
  lines.push("");

  // RegisterRoutes — header-body pattern
  lines.push(`func (h *Handler${JP}) RegisterRoutes${JP}(mux *http.ServeMux) {`);
  lines.push(`\tmux.HandleFunc("GET /${JP}", h.HandlePage${JP})`);
  lines.push(`\tmux.HandleFunc("GET /${JP}/new", h.HandleNew${JP})`);
  lines.push(`\tmux.HandleFunc("GET /${JP}/{id}", h.HandleEdit${JP})`);
  lines.push(`\tmux.HandleFunc("GET ${apiPath}", h.Handle一覧${JP})`);
  lines.push(`\tmux.HandleFunc("GET ${apiPath}/export", h.HandleExport${JP})`);
  lines.push(`\tmux.HandleFunc("POST ${apiPath}", h.Handle登録${JP})`);
  lines.push(`\tmux.HandleFunc("DELETE ${apiPath}", h.Handle一括削除${JP})`);
  lines.push(`\tmux.HandleFunc("PUT ${apiPath}/{id}", h.Handle更新${JP})`);
  lines.push(`\tmux.HandleFunc("DELETE ${apiPath}/{id}", h.Handle削除${JP})`);
  lines.push(`\tmux.HandleFunc("GET ${apiPath}/line-row", h.HandleLineRow${JP})`);
  lines.push("}");
  lines.push("");

  // HandlePage — list page
  lines.push(`func (h *Handler${JP}) HandlePage${JP}(w http.ResponseWriter, r *http.Request) {`);
  lines.push(`\tw.Header().Set("Content-Type", "text/html; charset=utf-8")`);
  lines.push(`\tRenderPage${JP}().Render(r.Context(), w)`);
  lines.push("}");
  lines.push("");

  // HandleNew — new form page
  lines.push(`func (h *Handler${JP}) HandleNew${JP}(w http.ResponseWriter, r *http.Request) {`);
  lines.push(`\tw.Header().Set("Content-Type", "text/html; charset=utf-8")`);
  lines.push(`\tRenderNewPage${JP}().Render(r.Context(), w)`);
  lines.push("}");
  lines.push("");

  // HandleEdit — edit form page
  lines.push(`func (h *Handler${JP}) HandleEdit${JP}(w http.ResponseWriter, r *http.Request) {`);
  lines.push(`\tid, err := strconv.Atoi(r.PathValue("id"))`);
  lines.push("\tif err != nil {");
  lines.push(`\t\thttp.Error(w, "Invalid ID", http.StatusBadRequest)`);
  lines.push("\t\treturn");
  lines.push("\t}");
  lines.push(`\tdetail, err := h.GetByID${JP}詳細(r.Context(), id)`);
  lines.push("\tif err != nil {");
  lines.push(`\t\thttp.Error(w, "Not found", http.StatusNotFound)`);
  lines.push("\t\treturn");
  lines.push("\t}");
  lines.push(`\tw.Header().Set("Content-Type", "text/html; charset=utf-8")`);
  lines.push(`\tRenderEditPage${JP}(detail).Render(r.Context(), w)`);
  lines.push("}");
  lines.push("");

  // Handle一覧
  lines.push(`func (h *Handler${JP}) Handle一覧${JP}(w http.ResponseWriter, r *http.Request) {`);
  lines.push(`\tpage, _ := strconv.Atoi(r.URL.Query().Get("page"))`);
  lines.push("\tif page < 1 { page = 1 }");
  lines.push(`\tsize, _ := strconv.Atoi(r.URL.Query().Get("size"))`);
  lines.push("\tif size < 1 { size = 20 }");
  for (const l of genSearchParamsParse(JP, config.searchFields)) {
    lines.push(l);
  }
  lines.push("\tif err != nil {");
  lines.push("\t\thttp.Error(w, err.Error(), http.StatusInternalServerError)");
  lines.push("\t\treturn");
  lines.push("\t}");
  lines.push(`\tw.Header().Set("Content-Type", "text/html; charset=utf-8")`);
  lines.push(`\tRenderRows${JP}(result).Render(r.Context(), w)`);
  lines.push("}");
  lines.push("");

  // Handle登録 — redirect after create
  lines.push(`func (h *Handler${JP}) Handle登録${JP}(w http.ResponseWriter, r *http.Request) {`);
  lines.push("\tif err := r.ParseForm(); err != nil {");
  lines.push(`\t\thttp.Error(w, "Bad request", http.StatusBadRequest)`);
  lines.push("\t\treturn");
  lines.push("\t}");
  lines.push(`\tinput := Parse作成Form${JP}(r)`);
  lines.push(`\tresult, err := h.Execute登録${JP}(r.Context(), input)`);
  lines.push("\tif err != nil {");
  lines.push(`\t\tw.Header().Set("Content-Type", "text/html; charset=utf-8")`);
  lines.push("\t\tw.WriteHeader(http.StatusUnprocessableEntity)");
  lines.push(`\t\tRenderErrorMessage(err.Error()).Render(r.Context(), w)`);
  lines.push("\t\treturn");
  lines.push("\t}");
  lines.push(`\tw.Header().Set("HX-Redirect", fmt.Sprintf("/${JP}/%d?saved=1", result.Id))`);
  lines.push("\tw.WriteHeader(http.StatusNoContent)");
  lines.push("}");
  lines.push("");

  // Handle更新 — redirect after update
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
  lines.push(`\t_, err = h.Execute更新${JP}(r.Context(), input)`);
  lines.push("\tif err != nil {");
  lines.push(`\t\tw.Header().Set("Content-Type", "text/html; charset=utf-8")`);
  lines.push("\t\tw.WriteHeader(http.StatusUnprocessableEntity)");
  lines.push(`\t\tRenderErrorMessage(err.Error()).Render(r.Context(), w)`);
  lines.push("\t\treturn");
  lines.push("\t}");
  lines.push(`\tw.Header().Set("HX-Redirect", fmt.Sprintf("/${JP}/%d?saved=1", id))`);
  lines.push("\tw.WriteHeader(http.StatusNoContent)");
  lines.push("}");
  lines.push("");

  // Handle削除 — redirect to list
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
  lines.push(`\tw.Header().Set("HX-Redirect", "/${JP}")`);
  lines.push("\tw.WriteHeader(http.StatusNoContent)");
  lines.push("}");
  lines.push("");

  // Handle一括削除
  lines.push(`func (h *Handler${JP}) Handle一括削除${JP}(w http.ResponseWriter, r *http.Request) {`);
  lines.push(`\tform, err := ParseDeleteForm(r)`);
  lines.push("\tif err != nil {");
  lines.push(`\t\thttp.Error(w, "Bad request", http.StatusBadRequest)`);
  lines.push("\t\treturn");
  lines.push("\t}");
  lines.push(`\tids := ParseIntSlice(form["ids[]"])`);
  lines.push(`\tif err := h.Execute一括削除${JP}(r.Context(), 一括削除Input${JP}{IDs: ids}); err != nil {`);
  lines.push("\t\thttp.Error(w, err.Error(), http.StatusInternalServerError)");
  lines.push("\t\treturn");
  lines.push("\t}");
  lines.push("\tw.WriteHeader(http.StatusOK)");
  lines.push("}");
  lines.push("");

  // HandleLineRow — return empty child row for htmx add
  lines.push(`func (h *Handler${JP}) HandleLineRow${JP}(w http.ResponseWriter, r *http.Request) {`);
  lines.push(`\tsection, _ := strconv.Atoi(r.URL.Query().Get("section"))`);
  lines.push(`\trowKey := fmt.Sprintf("new-%d-%s", time.Now().UnixMilli(), r.URL.Query().Get("section"))`);
  lines.push(`\tw.Header().Set("Content-Type", "text/html; charset=utf-8")`);
  lines.push(`\tRenderLineRow${JP}(section, rowKey).Render(r.Context(), w)`);
  lines.push("}");
  lines.push("");

  // HandleExport (HeaderBody)
  const exportCols = headerColumns.filter((c) => c.type !== "actions" && c.type !== "itemCode" && c.type !== "readonlyLookup" && entity?.fields.some((f) => f.goName === toPascalCase(c.key)));
  if (exportCols.length > 0 && entity) {
    lines.push(`func (h *Handler${JP}) HandleExport${JP}(w http.ResponseWriter, r *http.Request) {`);
    lines.push(`\tformat := r.URL.Query().Get("format")`);
    lines.push(`\tif format == "" { format = "csv" }`);
    const searchFields = config.searchFields ?? [];
    if (searchFields.length === 0) {
      lines.push(`\tsearch := r.URL.Query().Get("q")`);
      lines.push(`\trecords, err := h.GetExport${JP}(r.Context(), 一覧Input${JP}{Search: search})`);
    } else {
      for (const sf of searchFields) {
        lines.push(`\t${sf.param}Param := r.URL.Query().Get("${sf.param}")`);
      }
      const fieldInits = searchFields.map((sf) => `${toPascalCase(sf.param)}: ${sf.param}Param`).join(", ");
      lines.push(`\trecords, err := h.GetExport${JP}(r.Context(), 一覧Input${JP}{${fieldInits}})`);
    }
    lines.push("\tif err != nil {");
    lines.push("\t\thttp.Error(w, err.Error(), http.StatusInternalServerError)");
    lines.push("\t\treturn");
    lines.push("\t}");
    const csvHeaders = exportCols.map((c) => `"${c.label}"`).join(", ");
    const rowFields = exportCols.map((col) => {
      const goField = toPascalCase(col.key);
      const field = entity.fields.find((f) => f.goName === goField);
      if (!field) return `fmt.Sprintf("%v", item.${goField})`;
      if (field.goType === "sql.NullString") return `NullStrOr(item.${goField}, "")`;
      if (field.goType === "int" || field.goType === "int64") return `fmt.Sprintf("%d", item.${goField})`;
      if (field.goType === "float64") return `fmt.Sprintf("%f", item.${goField})`;
      return `item.${goField}`;
    });
    lines.push(`\theaders := []string{${csvHeaders}}`);
    lines.push(`\trows := make([][]string, 0, len(records))`);
    lines.push(`\tfor _, item := range records {`);
    lines.push(`\t\trows = append(rows, []string{${rowFields.join(", ")}})`);
    lines.push(`\t}`);
    lines.push(`\tsuffix := time.Now().Format("20060102")`);
    lines.push(`\tif format == "xlsx" {`);
    lines.push(`\t\tWriteXLSX(w, "${JP}_"+suffix+".xlsx", headers, rows)`);
    lines.push(`\t\treturn`);
    lines.push(`\t}`);
    lines.push(`\tfilename := "${JP}_" + suffix`);
    lines.push(`\tmime := "text/csv;charset=utf-8"`);
    lines.push(`\tif format == "tsv" {`);
    lines.push(`\t\tmime = "text/tab-separated-values;charset=utf-8"`);
    lines.push(`\t\tfilename += ".tsv"`);
    lines.push(`\t} else {`);
    lines.push(`\t\tfilename += ".csv"`);
    lines.push(`\t}`);
    lines.push(`\tw.Header().Set("Content-Type", mime)`);
    lines.push(`\tw.Header().Set("Content-Disposition", "attachment; filename=\\""+filename+"\\"" )`);
    lines.push(`\tw.Write([]byte{0xEF, 0xBB, 0xBF})`);
    lines.push(`\tcw := csv.NewWriter(w)`);
    lines.push(`\tif format == "tsv" { cw.Comma = '\\t' }`);
    lines.push(`\tcw.Write(headers)`);
    lines.push(`\tfor _, row := range rows {`);
    lines.push(`\t\tcw.Write(row)`);
    lines.push(`\t}`);
    lines.push(`\tcw.Flush()`);
    lines.push("}");
    lines.push("");
  }

  return lines.join("\n");
}

function genHeaderBodyViewsTempl(parentEntity: EntityDef, fm: FeatureMapping, hbDef: HeaderBodyDef): string {
  const JP = fm.jpName;
  const config = hbDef.entityConfig;
  const apiPath = config.baseUrl;
  const headerCols = hbDef.headerColumns;
  const colCount = headerCols.length + 1; // +1 for actions

  const TW = {
    thCell: "py-4 px-6 text-[0.625rem] font-bold text-on-surface-variant uppercase tracking-widest",
    tdCell: "py-4 px-6 text-on-surface-variant text-sm",
    row: "transition-all duration-200 ease-in-out hover:bg-surface-container-low [&.htmx-swapping]:opacity-0",
    buttonPrimary: "text-sm py-2 px-4 rounded-lg cursor-pointer font-semibold transition-all duration-200 inline-flex items-center justify-center border-none bg-gradient-to-br from-primary to-primary-dark text-white hover:opacity-90 active:opacity-80",
    buttonSecondary: "text-sm py-2 px-4 rounded-lg cursor-pointer font-semibold transition-all duration-200 inline-flex items-center justify-center border-none bg-transparent text-primary hover:bg-surface-container-high active:bg-surface-container-highest",
    ghostBtnDanger: "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all duration-150 text-error bg-error-container/20 border-none hover:bg-error-container/40 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-error-container/20",
    pageContainer: "max-w-[87.5rem] mx-auto py-8 px-8",
    pageTitle: "text-2xl font-bold mb-8 text-on-surface tracking-tight",
    paginationBar: "flex justify-between items-center py-4 px-6 bg-surface-container-low rounded-b-xl flex-wrap gap-3",
    activePageBtn: "w-8 h-8 flex items-center justify-center text-xs font-bold rounded-lg bg-gradient-to-br from-primary to-primary-dark text-white cursor-default border-none",
    inactivePageBtn: "w-8 h-8 flex items-center justify-center text-xs font-bold rounded-lg cursor-pointer text-on-surface hover:bg-surface-container-high border-none",
    disabledPageBtn: "w-8 h-8 flex items-center justify-center text-xs rounded-lg text-outline-variant cursor-default border-none",
    inputStyle: "rounded-lg text-sm text-on-surface outline-none bg-surface-container-low border-2 border-transparent transition-[border-color,background-color] duration-200 focus:border-b-primary focus:bg-white px-3 py-2.5 w-full",
    inputStyleSm: "rounded-lg text-sm text-on-surface outline-none bg-surface-container-low border-2 border-transparent transition-[border-color,background-color] duration-200 focus:border-b-primary focus:bg-white py-1.5 px-2.5 w-full min-w-[7.5rem]",
    editBtn: "inline-flex items-center gap-1 text-primary text-xs font-bold px-2 py-1 rounded-md cursor-pointer border-none bg-transparent no-underline hover:bg-primary/10",
    kebabBtn: "inline-flex items-center justify-center w-7 h-7 rounded-full cursor-pointer text-outline border-none bg-transparent hover:text-on-surface hover:bg-surface-container-low",
    kebabMenu: "absolute right-0 top-full z-20 mt-1 bg-white rounded-lg shadow-[0_10px_30px_-5px_rgba(18,28,42,0.08)] py-1 min-w-[120px]",
    kebabItem: "flex items-center gap-2 w-full text-left px-3 py-2 text-sm cursor-pointer text-error border-none bg-transparent hover:bg-error-container/30",
  };

  const lines: string[] = [];
  lines.push("// Code generated by gen-go.ts. DO NOT EDIT.");
  lines.push("package features");
  lines.push("");
  lines.push("import (");
  lines.push('\t"fmt"');
  lines.push('\t"aha-goth/internal/ui"');
  lines.push(")");
  lines.push("");

  // ── Page (list) ──
  lines.push(`templ RenderPage${JP}() {`);
  lines.push(`\t@ui.Base("${JP}管理") {`);
  lines.push(`\t\t<main class="${TW.pageContainer}">`);
  lines.push(`\t\t\t@ui.Nav("${navKey(JP)}")`);
  lines.push(`\t\t\t<h1 class="${TW.pageTitle}">${JP}管理</h1>`);
  lines.push(`\t\t\t<div class="flex justify-end mb-4">`);
  lines.push(`\t\t\t\t<a href="/${JP}/new" class="${TW.buttonPrimary}">＋ ${config.formTitle}</a>`);
  lines.push(`\t\t\t</div>`);
  lines.push(`\t\t\t<div class="overflow-x-auto rounded-xl bg-white">`);
  lines.push(`\t\t\t\t<table style="width: 100%; border-collapse: collapse;">`);
  lines.push(`\t\t\t\t\t<thead>`);
  lines.push(`\t\t\t\t\t\t<tr>`);
  for (const col of headerCols) {
    lines.push(`\t\t\t\t\t\t\t<th class="${TW.thCell}">${col.label}</th>`);
  }
  lines.push(`\t\t\t\t\t\t\t<th class="${TW.thCell}" style="width: 10rem;">操作</th>`);
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

  // ── Row (list row) ──
  lines.push(`templ RenderRow${JP}(item Response${JP}) {`);
  lines.push(`\t<tr id={ fmt.Sprintf("${config.idPrefix}-%d", item.Id) } class="${TW.row}">`);
  for (const col of headerCols) {
    const goField = toPascalCase(col.key);
    lines.push(`\t\t<td class="${TW.tdCell}">{ item.${goField} }</td>`);
  }
  lines.push(`\t\t<td class="py-4 px-6 text-right">`);
  lines.push(`\t\t\t<div class="flex items-center justify-end gap-2">`);
  usedIcons.add("pencil-square"); usedIcons.add("ellipsis-vertical-solid"); usedIcons.add("trash");
  lines.push(`\t\t\t\t<a href={ fmt.Sprintf("/${JP}/%d", item.Id) } class="${TW.editBtn} no-underline">`);
  lines.push(`\t\t\t\t\t@ui.Icon("pencil-square", "w-3.5 h-3.5")`);
  lines.push(`\t\t\t\t\t編集`);
  lines.push(`\t\t\t\t</a>`);
  lines.push(`\t\t\t\t<div class="relative" x-data="{ menuOpen: false }" @click.outside="menuOpen = false">`);
  lines.push(`\t\t\t\t\t<button class="${TW.kebabBtn}" @click="menuOpen = !menuOpen" type="button">`);
  lines.push(`\t\t\t\t\t\t@ui.Icon("ellipsis-vertical-solid", "w-5 h-5")`);
  lines.push(`\t\t\t\t\t</button>`);
  lines.push(`\t\t\t\t\t<div class="${TW.kebabMenu}" x-show="menuOpen" x-transition x-cloak>`);
  lines.push(`\t\t\t\t\t\t<button class="${TW.kebabItem}" hx-delete={ fmt.Sprintf("${apiPath}/%d", item.Id) } hx-target={ fmt.Sprintf("#${config.idPrefix}-%d", item.Id) } hx-swap="outerHTML swap:0.3s" hx-confirm="${config.deleteConfirmTemplate}" @click="menuOpen = false">`);
  lines.push(`\t\t\t\t\t\t\t@ui.Icon("trash", "w-4 h-4")`);
  lines.push(`\t\t\t\t\t\t\t削除`);
  lines.push(`\t\t\t\t\t\t</button>`);
  lines.push(`\t\t\t\t\t</div>`);
  lines.push(`\t\t\t\t</div>`);
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

  // ── Pagination (OOB) ── (same as flat pattern)
  lines.push(`templ RenderPagination${JP}(result ListResult${JP}) {`);
  lines.push(`\t<div id="${config.paginationId}" hx-swap-oob="true" class="${TW.paginationBar}">`);
  lines.push(`\t\t<div class="flex items-center gap-2 text-sm text-on-surface-variant">`);
  lines.push(`\t\t\t<span>表示件数:</span>`);
  lines.push(`\t\t\t<select name="size" hx-get="${apiPath}" hx-target="#${config.bodyTargetId}" hx-swap="innerHTML" hx-include="this" hx-vals='{"page": "1"}' class="bg-white rounded-md text-sm py-1 px-2 text-on-surface-variant border-none cursor-pointer outline-none focus:shadow-[0_0_0_1px_var(--color-primary)]">`);
  for (const s of [20, 50, 100]) {
    lines.push(`\t\t\t\t<option value="${s}" if result.PageSize == ${s} { selected }>${s}件</option>`);
  }
  lines.push(`\t\t\t</select>`);
  lines.push(`\t\t</div>`);
  lines.push(`\t\tif result.TotalPages > 1 {`);
  lines.push(`\t\t\t<div class="flex items-center gap-1">`);
  lines.push(`\t\t\t\tif result.CurrentPage > 1 {`);
  lines.push(`\t\t\t\t\t<button class="${TW.inactivePageBtn}" hx-get={ fmt.Sprintf("${apiPath}?page=%d&size=%d", result.CurrentPage-1, result.PageSize) } hx-target="#${config.bodyTargetId}" hx-swap="innerHTML">&#8249;</button>`);
  lines.push(`\t\t\t\t} else {`);
  lines.push(`\t\t\t\t\t<span class="${TW.disabledPageBtn}">&#8249;</span>`);
  lines.push(`\t\t\t\t}`);
  lines.push(`\t\t\t\tfor i := 1; i <= result.TotalPages; i++ {`);
  lines.push(`\t\t\t\t\tif i == result.CurrentPage {`);
  lines.push(`\t\t\t\t\t\t<span class="${TW.activePageBtn}">{ fmt.Sprintf("%d", i) }</span>`);
  lines.push(`\t\t\t\t\t} else {`);
  lines.push(`\t\t\t\t\t\t<button class="${TW.inactivePageBtn}" hx-get={ fmt.Sprintf("${apiPath}?page=%d&size=%d", i, result.PageSize) } hx-target="#${config.bodyTargetId}" hx-swap="innerHTML">{ fmt.Sprintf("%d", i) }</button>`);
  lines.push(`\t\t\t\t\t}`);
  lines.push(`\t\t\t\t}`);
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

  // ── NewPage (create form) ──
  lines.push(`templ RenderNewPage${JP}() {`);
  lines.push(`\t@ui.Base("${config.formTitle}") {`);
  lines.push(`\t\t<main class="${TW.pageContainer}">`);
  lines.push(`\t\t\t@ui.Nav("${navKey(JP)}")`);
  lines.push(`\t\t\t<h1 class="${TW.pageTitle}">${config.formTitle}</h1>`);
  // form
  lines.push(`\t\t\t<form hx-post="${apiPath}" hx-swap="innerHTML" hx-target="#${config.idPrefix}-error">`);
  lines.push(`\t\t\t\t<div id="${config.idPrefix}-error" class="min-h-6 mb-2"></div>`);
  // header card
  lines.push(`\t\t\t\t<div class="mb-6 p-6 rounded-xl bg-white">`);
  lines.push(`\t\t\t\t\t<h2 class="text-lg font-bold text-on-surface mb-4 tracking-tight">${config.formTitle}</h2>`);
  lines.push(`\t\t\t\t\t<div class="grid grid-cols-${Math.min(headerCols.length, 3)} gap-4 mb-2">`);
  for (const col of headerCols) {
    const inputType = col.type === "number" ? "number" : col.type === "date" ? "date" : "text";
    lines.push(`\t\t\t\t\t\t<label class="flex flex-col gap-2 text-[0.625rem] font-bold uppercase tracking-wider text-outline">${col.label}<input type="${inputType}" name="${col.key}"${col.placeholder ? ` placeholder="${col.placeholder}"` : ""}${col.required ? " required" : ""} class="${TW.inputStyle}"/></label>`);
  }
  lines.push(`\t\t\t\t\t</div>`);
  lines.push(`\t\t\t\t</div>`);
  // child sections (empty)
  const badgeColors = ["#1e40af", "#b45309", "#0e7490", "#7c3aed"];
  for (let idx = 0; idx < hbDef.children.length; idx++) {
    const child = hbDef.children[idx];
    const childDataCols = child.columns.filter((c: ColumnDef) => c.type !== "deleteAction");
    const badgeColor = badgeColors[idx % badgeColors.length];
    const badgeText = child.sectionLabel.match(/^(.+?)（/)?.[1] ?? child.sectionLabel;
    lines.push(`\t\t\t\t<div class="mb-6 p-6 rounded-xl bg-white">`);
    lines.push(`\t\t\t\t\t<div class="text-base font-bold text-on-surface mb-3 flex items-center gap-2"><span class="text-xs font-bold px-2 py-0.5 rounded-full text-white" style="background: ${badgeColor};">${badgeText}</span>${child.sectionLabel}</div>`);
    lines.push(`\t\t\t\t\t<table style="width: 100%; border-collapse: collapse;">`);
    lines.push(`\t\t\t\t\t\t<thead><tr>`);
    for (const c of childDataCols) {
      lines.push(`\t\t\t\t\t\t\t<th class="${TW.thCell}">${c.label}</th>`);
    }
    lines.push(`\t\t\t\t\t\t\t<th class="${TW.thCell}" style="width: 3rem;"></th>`);
    lines.push(`\t\t\t\t\t\t</tr></thead>`);
    lines.push(`\t\t\t\t\t\t<tbody id="section-${idx}-lines"></tbody>`);
    lines.push(`\t\t\t\t\t</table>`);
    lines.push(`\t\t\t\t\t<div style="margin-top: 0.5rem;"><button type="button" class="inline-flex items-center gap-1 text-sm text-primary font-semibold cursor-pointer border-none bg-transparent px-2 py-1.5 rounded-md hover:bg-surface-container-high" hx-get="${apiPath}/line-row?section=${idx}" hx-target="#section-${idx}-lines" hx-swap="beforeend">+ 行追加</button></div>`);
    lines.push(`\t\t\t\t</div>`);
  }
  // footer
  lines.push(`\t\t\t\t<div class="flex gap-3 justify-end mt-6">`);
  lines.push(`\t\t\t\t\t<a href="/${JP}" class="${TW.buttonSecondary}">キャンセル</a>`);
  lines.push(`\t\t\t\t\t<button type="submit" class="${TW.buttonPrimary}">登録</button>`);
  lines.push(`\t\t\t\t</div>`);
  lines.push(`\t\t\t</form>`);
  lines.push(`\t\t</main>`);
  lines.push(`\t\t@ui.Notifications()`);
  lines.push(`\t}`);
  lines.push("}");
  lines.push("");

  // ── EditPage (edit form with data) ──
  lines.push(`templ RenderEditPage${JP}(detail Response${JP}詳細) {`);
  lines.push(`\t@ui.Base("${JP}編集") {`);
  lines.push(`\t\t<main class="${TW.pageContainer}">`);
  lines.push(`\t\t\t@ui.Nav("${navKey(JP)}")`);
  lines.push(`\t\t\t<h1 class="${TW.pageTitle}">${JP}編集</h1>`);
  // form
  lines.push(`\t\t\t<form hx-put={ fmt.Sprintf("${apiPath}/%d", detail.Id) } hx-swap="innerHTML" hx-target="#${config.idPrefix}-error">`);
  lines.push(`\t\t\t\t<div id="${config.idPrefix}-error" class="min-h-6 mb-2"></div>`);
  // header card with existing values
  lines.push(`\t\t\t\t<div class="mb-6 p-6 rounded-xl bg-white">`);
  lines.push(`\t\t\t\t\t<h2 class="text-lg font-bold text-on-surface mb-4 tracking-tight">${JP}情報</h2>`);
  lines.push(`\t\t\t\t\t<div class="grid grid-cols-${Math.min(headerCols.length, 3)} gap-4 mb-2">`);
  for (const col of headerCols) {
    const goField = toPascalCase(col.key);
    const inputType = col.type === "number" ? "number" : col.type === "date" ? "date" : "text";
    lines.push(`\t\t\t\t\t\t<label class="flex flex-col gap-2 text-[0.625rem] font-bold uppercase tracking-wider text-outline">${col.label}<input type="${inputType}" name="${col.key}" value={ detail.${goField} }${col.placeholder ? ` placeholder="${col.placeholder}"` : ""}${col.required ? " required" : ""} class="${TW.inputStyle}"/></label>`);
  }
  lines.push(`\t\t\t\t\t</div>`);
  lines.push(`\t\t\t\t</div>`);
  // child sections with existing data
  for (let idx = 0; idx < hbDef.children.length; idx++) {
    const child = hbDef.children[idx];
    const childDataCols = child.columns.filter((c: ColumnDef) => c.type !== "deleteAction");
    // Determine the Go field name for this child's data in Response詳細
    const fieldName = child.discriminatorValue
      ? `${child.sectionLabel.replace(/[（）\(\)]/g, "").replace(/\s/g, "")}`
      : `Lines`;
    const badgeColorEdit = badgeColors[idx % badgeColors.length];
    const badgeTextEdit = child.sectionLabel.match(/^(.+?)（/)?.[1] ?? child.sectionLabel;
    lines.push(`\t\t\t\t<div class="mb-6 p-6 rounded-xl bg-white">`);
    lines.push(`\t\t\t\t\t<div class="text-base font-bold text-on-surface mb-3 flex items-center gap-2"><span class="text-xs font-bold px-2 py-0.5 rounded-full text-white" style="background: ${badgeColorEdit};">${badgeTextEdit}</span>${child.sectionLabel}</div>`);
    lines.push(`\t\t\t\t\t<table style="width: 100%; border-collapse: collapse;">`);
    lines.push(`\t\t\t\t\t\t<thead><tr>`);
    for (const c of childDataCols) {
      lines.push(`\t\t\t\t\t\t\t<th class="${TW.thCell}">${c.label}</th>`);
    }
    lines.push(`\t\t\t\t\t\t\t<th class="${TW.thCell}" style="width: 3rem;"></th>`);
    lines.push(`\t\t\t\t\t\t</tr></thead>`);
    lines.push(`\t\t\t\t\t\t<tbody id="section-${idx}-lines">`);
    lines.push(`\t\t\t\t\t\t\tfor _, line := range detail.${fieldName} {`);
    lines.push(`\t\t\t\t\t\t\t\t@RenderExistingLineRow${JP}${idx}(line)`);
    lines.push(`\t\t\t\t\t\t\t}`);
    lines.push(`\t\t\t\t\t\t</tbody>`);
    lines.push(`\t\t\t\t\t</table>`);
    lines.push(`\t\t\t\t\t<div style="margin-top: 0.5rem;"><button type="button" class="inline-flex items-center gap-1 text-sm text-primary font-semibold cursor-pointer border-none bg-transparent px-2 py-1.5 rounded-md hover:bg-surface-container-high" hx-get="${apiPath}/line-row?section=${idx}" hx-target="#section-${idx}-lines" hx-swap="beforeend">+ 行追加</button></div>`);
    lines.push(`\t\t\t\t</div>`);
  }
  // footer
  lines.push(`\t\t\t\t<div class="flex gap-3 justify-end mt-6">`);
  lines.push(`\t\t\t\t\t<a href="/${JP}" class="${TW.buttonSecondary}">キャンセル</a>`);
  lines.push(`\t\t\t\t\t<button type="submit" class="${TW.buttonPrimary}">更新</button>`);
  lines.push(`\t\t\t\t</div>`);
  lines.push(`\t\t\t</form>`);
  lines.push(`\t\t</main>`);
  lines.push(`\t\t@ui.Notifications()`);
  lines.push(`\t}`);
  lines.push("}");
  lines.push("");

  // ── ExistingLineRow (for edit page, pre-filled child rows) ──
  const childTablesSeen = new Set<string>();
  for (let idx = 0; idx < hbDef.children.length; idx++) {
    const child = hbDef.children[idx];
    const childStruct = toPascalCase(child.tableName);
    const childDataCols = child.columns.filter((c: ColumnDef) => c.type !== "deleteAction");

    lines.push(`templ RenderExistingLineRow${JP}${idx}(line ${childStruct}) {`);
    lines.push(`\t<tr class="${TW.row}">`);
    // hidden discriminator
    if (child.discriminatorColumn && child.discriminatorValue) {
      lines.push(`\t\t<input type="hidden" name="line${toPascalCase(child.discriminatorColumn)}" value="${child.discriminatorValue}"/>`);
    }
    for (const col of child.columns) {
      if (col.type === "deleteAction") {
        lines.push(`\t\t<td class="${TW.tdCell}" style="width: 3rem;"><button type="button" class="inline-flex items-center justify-center w-7 h-7 rounded-full cursor-pointer text-error border-none bg-transparent text-sm hover:bg-error/10" onclick="this.closest('tr').remove()">&times;</button></td>`);
      } else if (col.type === "itemCode") {
        lines.push(`\t\t<td class="${TW.tdCell}">@RenderTypeahead品目("line品目ID", line.品目ID, line.品目コード, line.品目名, true, true, fmt.Sprintf("lookup-%d-itemName", line.Id))</td>`);
      } else if (col.type === "readonlyLookup") {
        lines.push(`\t\t<td class="${TW.tdCell}"><span id={ fmt.Sprintf("lookup-%d-itemName", line.Id) } class="text-sm text-outline">{ line.品目名 }</span></td>`);
      } else if (col.type === "number") {
        const goField = toPascalCase(col.key);
        lines.push(`\t\t<td class="${TW.tdCell}"><input type="number" step="0.0001" name="line${toPascalCase(col.key)}" value={ line.${goField} } class="${TW.inputStyleSm}"/></td>`);
      } else if (col.type === "select") {
        lines.push(`\t\t<td class="${TW.tdCell}">@RenderSelectLine${JP}${idx}${toPascalCase(col.key)}(line.${toPascalCase(col.key)})</td>`);
      } else {
        const goField = toPascalCase(col.key);
        const nullable = child.columns.some((c: ColumnDef) => c.key === col.key);
        // Check if this field is nullable in the entity
        lines.push(`\t\t<td class="${TW.tdCell}"><input type="text" name="line${toPascalCase(col.key)}" value={ NullStrOr(line.${goField}, "") } class="${TW.inputStyleSm}"/></td>`);
      }
    }
    lines.push(`\t</tr>`);
    lines.push("}");
    lines.push("");
  }

  // ── Select helpers for child rows ──
  // select 型カラムごとに templ コンポーネントを生成（options をハードコード）
  for (let idx = 0; idx < hbDef.children.length; idx++) {
    const child = hbDef.children[idx];
    for (const col of child.columns) {
      if (col.type !== "select") continue;
      const selectCls = "rounded-lg text-sm text-on-surface outline-none bg-surface-container-low border-2 border-transparent transition-[border-color,background-color] duration-200 focus:border-b-primary focus:bg-white py-1.5 px-2.5 min-w-20";
      lines.push(`templ RenderSelectLine${JP}${idx}${toPascalCase(col.key)}(selected string) {`);
      lines.push(`\t<select name="line${toPascalCase(col.key)}" class="${selectCls}">`);
      for (const opt of col.options) {
        lines.push(`\t\t<option value="${opt.value}" if selected == "${opt.value}" { selected }>${opt.label}</option>`);
      }
      lines.push(`\t</select>`);
      lines.push("}");
      lines.push("");
    }
  }

  // ── LineRow (empty child row for htmx add) ──
  // Generates per-section empty rows with proper form inputs
  // rowKey はハンドラ側で生成してテンプレートに渡す
  for (let idx = 0; idx < hbDef.children.length; idx++) {
    const child = hbDef.children[idx];
    lines.push(`templ RenderEmptyLineRow${JP}${idx}(rowKey string) {`);
    lines.push(`\t<tr class="${TW.row}">`);
    if (child.discriminatorColumn && child.discriminatorValue) {
      lines.push(`\t\t<input type="hidden" name="line${toPascalCase(child.discriminatorColumn)}" value="${child.discriminatorValue}"/>`);
    }
    for (const col of child.columns) {
      if (col.type === "deleteAction") {
        lines.push(`\t\t<td class="${TW.tdCell}" style="width: 3rem;"><button type="button" class="inline-flex items-center justify-center w-7 h-7 rounded-full cursor-pointer text-error border-none bg-transparent text-sm hover:bg-error/10" onclick="this.closest('tr').remove()">&times;</button></td>`);
      } else if (col.type === "itemCode") {
        lines.push(`\t\t<td class="${TW.tdCell}">@RenderTypeahead品目("line品目ID", 0, "", "", true, true, fmt.Sprintf("lookup-%s-itemName", rowKey))</td>`);
      } else if (col.type === "readonlyLookup") {
        lines.push(`\t\t<td class="${TW.tdCell}"><span id={ fmt.Sprintf("lookup-%s-itemName", rowKey) } class="text-sm text-outline"></span></td>`);
      } else if (col.type === "number") {
        lines.push(`\t\t<td class="${TW.tdCell}"><input type="number" step="0.0001"${col.min !== undefined ? ` min="${col.min}"` : ""} name="line${toPascalCase(col.key)}" placeholder="${col.placeholder || "0"}" class="${TW.inputStyleSm}"/></td>`);
      } else if (col.type === "select") {
        lines.push(`\t\t<td class="${TW.tdCell}">@RenderSelectLine${JP}${idx}${toPascalCase(col.key)}("${col.defaultValue || ""}")</td>`);
      } else {
        lines.push(`\t\t<td class="${TW.tdCell}"><input type="text" name="line${toPascalCase(col.key)}" placeholder="${col.placeholder || ""}" class="${TW.inputStyleSm}"/></td>`);
      }
    }
    lines.push(`\t</tr>`);
    lines.push("}");
    lines.push("");
  }

  // Dispatcher that routes section index to the correct empty row template
  lines.push(`templ RenderLineRow${JP}(section int, rowKey string) {`);
  for (let idx = 0; idx < hbDef.children.length; idx++) {
    const cond = idx === 0 ? `if section == ${idx}` : `} else if section == ${idx}`;
    lines.push(`\t${cond} {`);
    lines.push(`\t\t@RenderEmptyLineRow${JP}${idx}(rowKey)`);
  }
  if (hbDef.children.length > 0) {
    lines.push(`\t}`);
  }
  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

function genHeaderBodyManualService(fm: FeatureMapping): string {
  const JP = fm.jpName;
  return `package features

import (
\t"context"
\t"net/http"

\t"database/sql"
)

// ─── Validate (service_gen.go から呼ばれる) ───

func Validate登録${JP}(_ context.Context, _ *sql.DB, _ 作成Input${JP}WithLines) error {
\treturn nil
}

func Validate更新${JP}(_ context.Context, _ *sql.DB, _ 更新Input${JP}WithLines) error {
\treturn nil
}

// ─── Form パーサー (handler_gen.go から呼ばれる) ───

func Parse作成Form${JP}(r *http.Request) 作成Input${JP}WithLines {
\t// TODO: r.FormValue(...) で親フィールド + 明細行をパース
\treturn 作成Input${JP}WithLines{}
}

func Parse更新Form${JP}(r *http.Request, id int) 更新Input${JP}WithLines {
\t// TODO: r.FormValue(...) で親フィールド + 明細行をパース
\treturn 更新Input${JP}WithLines{更新Input${JP}: 更新Input${JP}{ID: id}}
}

`;
}

function genHeaderBodyManualSQL(fm: FeatureMapping): string {
  const JP = fm.jpName;
  const table = sqlQ(fm.tableName);
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
\t// TODO: SELECT + COUNT + pagination from ${table}
\treturn ListResult${JP}{}, nil
}

func Execute登録SQL${JP}(ctx context.Context, db *sql.DB, input 作成Input${JP}WithLines) (Response${JP}, error) {
\t_ = time.Now
\t// TODO: BEGIN → INSERT INTO ${table} → INSERT child lines → COMMIT
\treturn Response${JP}{}, nil
}

func Execute更新SQL${JP}(ctx context.Context, db *sql.DB, input 更新Input${JP}WithLines) (Response${JP}, error) {
\t_ = time.Now
\t// TODO: BEGIN → UPDATE ${table} → DELETE old lines → INSERT new lines → COMMIT
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

func GetByID${JP}詳細SQL(ctx context.Context, db *sql.DB, id int) (Response${JP}詳細, error) {
\t// TODO: SELECT parent + JOIN child lines WHERE id=$1
\treturn Response${JP}詳細{}, nil
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

  // header-body パターンの検出
  const hbDef = parseHeaderBodyConfig(featureName);
  if (hbDef) {
    generateHeaderBodyFeature(featureName, fm, entity, entities, hbDef);
    return;
  }

  // flat CRUD パターン
  const configResult = parseConfigFile(featureName);
  const columns = configResult?.columns ?? [];
  const entityConfig: EntityConfigDef = configResult?.entity ?? {
    idPrefix: "row", baseUrl: `/api/${featureName}`, bodyTargetId: "data-body",
    paginationId: "data-pagination", formTitle: `新規${featureName}登録`,
    emptyMessage: `${featureName}がありません`, deleteConfirmTemplate: "削除しますか？",
    searchFields: [], searchContainerId: "row-search",
  };

  fs.mkdirSync(featuresDir, { recursive: true });

  const prefix = fm.jpName;
  const files: string[] = [];

  // _gen.* — 毎回上書き
  write(path.join(featuresDir, `${prefix}_types_gen.go`), genTypes(entity, fm, entityConfig.searchFields), files);
  write(path.join(featuresDir, `${prefix}_service_gen.go`), genService(fm), files);
  write(path.join(featuresDir, `${prefix}_handler_gen.go`), genHandler(fm, entityConfig, columns, entity), files);
  write(path.join(featuresDir, `${prefix}_views_gen.templ`), genViewsTempl(entity, fm, columns, entityConfig), files);

  // _cus_* — 初回のみ (DAO は go generate で生成するため _cus_sql.go は不要)
  writeOnce(path.join(featuresDir, `${prefix}_cus_service.go`), genManualService(fm), files);

  console.log("  files:");
  for (const f of files) console.log(`    ${path.relative(gothRoot, f)}`);
}

function generateHeaderBodyFeature(featureName: string, fm: FeatureMapping, parentEntity: EntityDef, allEntities: Map<string, EntityDef>, hbDef: HeaderBodyDef): void {
  // Collect child entities
  const childEntities = new Map<string, EntityDef>();
  for (const child of hbDef.children) {
    if (!childEntities.has(child.tableName)) {
      const childEntity = allEntities.get(child.tableName);
      if (!childEntity) {
        console.error(`  Child table ${child.tableName} not found in schema`);
        continue;
      }
      childEntities.set(child.tableName, childEntity);
    }
  }

  fs.mkdirSync(featuresDir, { recursive: true });

  const prefix = fm.jpName;
  const files: string[] = [];

  // _gen.* — 毎回上書き
  write(path.join(featuresDir, `${prefix}_types_gen.go`), genHeaderBodyTypes(parentEntity, childEntities, fm, hbDef), files);
  write(path.join(featuresDir, `${prefix}_service_gen.go`), genHeaderBodyService(fm, hbDef), files);
  write(path.join(featuresDir, `${prefix}_handler_gen.go`), genHeaderBodyHandler(fm, hbDef.entityConfig, hbDef.headerColumns, parentEntity), files);
  write(path.join(featuresDir, `${prefix}_views_gen.templ`), genHeaderBodyViewsTempl(parentEntity, fm, hbDef), files);

  // _cus_* — 初回のみ (DAO は go generate で生成するため _cus_sql.go は不要)
  writeOnce(path.join(featuresDir, `${prefix}_cus_service.go`), genHeaderBodyManualService(fm), files);

  console.log("  files (header-body):");
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

// ─── dao_config.json 生成 ──────────────────

interface DaoField {
  go: string; db: string; type: string;
  inputType?: string; pk?: boolean; auto?: boolean;
  timestamp?: boolean; nullable?: boolean;
}
interface DaoFilter { inputField: string; column: string; op: string; }
interface DaoSearch { inputField: string; columns: string[]; }
interface DaoChildInput { go: string; type: string; nullable?: boolean; }
interface DaoChild {
  struct: string; table: string; parentFK: string; parentFKGo: string;
  linesField: string; inputStruct: string;
  fields: DaoField[]; inputFields: DaoChildInput[];
}
interface DaoJoinField { column: string; as: string; }
interface DaoJoin { table: string; alias: string; childCol: string; parentCol: string; fields: DaoJoinField[]; }
interface DaoDiscGroup { value: number; responseField: string; }
interface DaoDisc { field: string; groups: DaoDiscGroup[]; }
interface DaoDetail { responseStruct: string; joins: DaoJoin[]; discriminator: DaoDisc; }
interface DaoEntity {
  name: string; table: string; rowStruct: string;
  responseStruct: string; listResultStruct: string;
  createInput: string; updateInput: string;
  deleteInput: string; batchDeleteInput: string; listInput: string;
  createWithLinesInput?: string; updateWithLinesInput?: string;
  fields: DaoField[];
  search?: DaoSearch; filters: DaoFilter[];
  child?: DaoChild; detail?: DaoDetail;
}

function fieldToDao(f: FieldDef): DaoField {
  const d: DaoField = { go: f.goName, db: f.dbColumn, type: f.goType };
  if (f.isPrimaryKey) { d.pk = true; d.auto = true; }
  if (f.goType === "time.Time") { d.timestamp = true; }
  if (f.goType === "sql.NullString") {
    d.nullable = true;
    d.inputType = "*string";
  }
  return d;
}

function buildDaoConfig(): { entities: DaoEntity[] } {
  const entities: DaoEntity[] = [];
  const allEntities = parseSchemaFile();

  for (const featureName of featuresToGenerate) {
    const fm = FEATURE_MAP[featureName];
    if (!fm) continue;
    const JP = fm.jpName;
    const entity = allEntities.get(fm.tableName);
    if (!entity) continue;

    const fields = entity.fields.map(fieldToDao);
    const configResult = parseConfigFile(featureName);
    const hbDef = parseHeaderBodyConfig(featureName);

    // search & filters from searchFields
    const searchFields = configResult?.entity.searchFields ?? hbDef?.entityConfig.searchFields ?? [];
    let search: DaoSearch | undefined;
    const filters: DaoFilter[] = [];

    for (const sf of searchFields) {
      if (sf.searchType === "text" && sf.dbColumns.length > 0) {
        if (!search) {
          // primary text search → ILIKE on multiple columns
          search = { inputField: toPascalCase(sf.param), columns: sf.dbColumns };
        } else {
          // additional text search → individual ILIKE filter
          filters.push({ inputField: toPascalCase(sf.param), column: sf.dbColumns[0], op: "ilike" });
        }
      } else if (sf.searchType === "select" && sf.dbColumns.length > 0) {
        filters.push({ inputField: toPascalCase(sf.param), column: sf.dbColumns[0], op: "ilike" });
      } else if (sf.searchType === "date") {
        // date filters: dbColumns may be empty, infer actual DB column from name pattern
        const dbCol = sf.dbColumns[0] || "日付";
        if (sf.param.includes("開始")) {
          filters.push({ inputField: toPascalCase(sf.param), column: dbCol, op: "gte" });
        } else if (sf.param.includes("終了")) {
          filters.push({ inputField: toPascalCase(sf.param), column: dbCol, op: "lte" });
        }
      }
    }

    // Header-body entities without searchFields: check if 一覧Input has Search field
    if (!search && hbDef) {
      // Default search on コード + 名称 for header-body entities
      const hasCodeField = entity.fields.some(f => f.dbColumn === "コード");
      const hasNameField = entity.fields.some(f => f.dbColumn === "名称");
      if (hasCodeField && hasNameField) {
        search = { inputField: "Search", columns: ["コード", "名称"] };
      }
    }

    const de: DaoEntity = {
      name: JP,
      table: fm.tableName,
      rowStruct: `Row${JP}`,
      responseStruct: `Response${JP}`,
      listResultStruct: `ListResult${JP}`,
      createInput: `作成Input${JP}`,
      updateInput: `更新Input${JP}`,
      deleteInput: `削除Input${JP}`,
      batchDeleteInput: `一括削除Input${JP}`,
      listInput: `一覧Input${JP}`,
      fields,
      search,
      filters,
    };

    // header-body child handling
    if (hbDef && hbDef.children.length > 0) {
      de.createWithLinesInput = `作成Input${JP}WithLines`;
      de.updateWithLinesInput = `更新Input${JP}WithLines`;

      const childDef = hbDef.children[0]; // primary child
      const childEntity = allEntities.get(childDef.tableName);
      if (childEntity) {
        const childFields = childEntity.fields.map(fieldToDao);
        // parentFK detection
        const parentFKField = childEntity.fields.find(f => {
          const upper = f.dbColumn.toUpperCase();
          return upper === `${fm.tableName.toUpperCase()}_ID` || upper === `${fm.tableName.replace(/ /g, "_").toUpperCase()}_ID`;
        });
        const parentFK = parentFKField?.dbColumn ?? `${fm.tableName}_ID`;
        const parentFKGo = parentFKField?.goName ?? toPascalCase(parentFK);

        // Build child input fields (non-pk, non-timestamp, non-parentFK)
        const childInputFields: DaoChildInput[] = childEntity.fields
          .filter(f => !f.isPrimaryKey && f.goType !== "time.Time" && f.dbColumn !== parentFK)
          .map(f => {
            const ci: DaoChildInput = { go: f.goName, type: f.goType };
            if (f.goType === "sql.NullString") {
              ci.type = "*string";
              ci.nullable = true;
            }
            return ci;
          });

        const childStructName = childDef.tableName.replace(/\s+/g, "");
        de.child = {
          struct: childStructName,
          table: childDef.tableName,
          parentFK,
          parentFKGo,
          linesField: `Lines${childStructName}`,
          inputStruct: `作成Input${childStructName}`,
          fields: childFields,
          inputFields: childInputFields,
        };

        // detail config
        if (hbDef.children.length >= 1) {
          const groups: DaoDiscGroup[] = [];
          for (const ch of hbDef.children) {
            if (ch.discriminatorValue && ch.discriminatorColumn) {
              groups.push({
                value: parseInt(ch.discriminatorValue, 10),
                responseField: ch.sectionLabel.replace(/[（）()]/g, ""),
              });
            }
          }
          if (groups.length > 0) {
            const discCol = hbDef.children[0].discriminatorColumn!;
            // detect join: look for FK columns ending with "ID" that reference other tables
            const joins: DaoJoin[] = [];
            if (childEntity) {
              for (const cf of childEntity.fields) {
                // Skip PK and parent FK
                if (cf.isPrimaryKey || cf.dbColumn === parentFK) continue;
                // FK pattern: ends with "ID" and references another table
                if (cf.dbColumn.endsWith("ID") && cf.dbColumn !== parentFK) {
                  const refTable = cf.dbColumn.replace(/ID$/, "");
                  const refEntity = allEntities.get(refTable);
                  if (refEntity) {
                    // Find コード and 名称 fields in referenced table
                    const hasCode = refEntity.fields.some(f => f.dbColumn === "コード");
                    const hasName = refEntity.fields.some(f => f.dbColumn === "名称");
                    if (hasCode && hasName) {
                      joins.push({
                        table: refTable,
                        alias: "i",
                        childCol: cf.dbColumn,
                        parentCol: "id",
                        fields: [
                          { column: "コード", as: `${refTable}コード` },
                          { column: "名称", as: `${refTable}名` },
                        ],
                      });
                    }
                  }
                }
              }
            }

            de.detail = {
              responseStruct: `Response${JP}詳細`,
              joins,
              discriminator: { field: discCol, groups },
            };
          }
        }
      }
    }

    entities.push(de);
  }

  return { entities };
}

// ─── 実行 ──────────────────────────────

console.log("aha → GoTH コード生成 (再整備版)");
console.log(`features: ${featuresToGenerate.join(", ")}`);

// 共通
fs.mkdirSync(featuresDir, { recursive: true });
fs.writeFileSync(path.join(featuresDir, "error_gen.templ"), genErrorTempl());
fs.writeFileSync(path.join(featuresDir, "helpers_gen.go"), genHelpers());

// nav_gen.templ (Nav.astro から動的生成)
const uiDir = path.join(gothRoot, "internal/ui");
fs.mkdirSync(uiDir, { recursive: true });
fs.writeFileSync(path.join(uiDir, "nav_gen.templ"), genNavTempl());
// 旧手動 nav.templ があれば削除
const oldNavPath = path.join(uiDir, "nav.templ");
if (fs.existsSync(oldNavPath)) fs.unlinkSync(oldNavPath);

for (const f of featuresToGenerate) generateFeature(f);

// dao_config.json 生成
const daoConfig = buildDaoConfig();
fs.writeFileSync(path.join(featuresDir, "dao_config.json"), JSON.stringify(daoConfig, null, 2));
console.log("\ndao_config.json generated");

// icon_manifest.json 生成 (bundle-static.ts が参照して icons_gen.templ を生成)
const iconManifest = [...usedIcons].sort();
fs.writeFileSync(path.join(gothRoot, "icon_manifest.json"), JSON.stringify(iconManifest, null, 2));
console.log(`icon_manifest.json generated (${iconManifest.length} icons: ${iconManifest.join(", ")})`);

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
