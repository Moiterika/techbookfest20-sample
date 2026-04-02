/**
 * ts-parser.ts — ts-morph ベースの TS ソースパーサー
 *
 * gen-go.ts の正規表現パーサーを置き換え、AST から正確に情報を抽出する。
 */

import {
  Project,
  SyntaxKind,
  type SourceFile,
  type ObjectLiteralExpression,
  type ArrayLiteralExpression,
  type PropertyAssignment,
  type CallExpression,
  type Node,
} from "ts-morph";

const project = new Project({ compilerOptions: { allowJs: true } });

/** SourceFile をキャッシュ付きで取得 */
export function getSourceFile(filePath: string): SourceFile {
  const existing = project.getSourceFile(filePath);
  if (existing) return existing;
  return project.addSourceFileAtPath(filePath);
}

// ─── ObjectLiteralExpression ヘルパー ────────────

/** オブジェクトリテラルから文字列プロパティを取得 */
export function getStringProp(obj: ObjectLiteralExpression, key: string): string | null {
  const prop = obj.getProperty(key);
  if (!prop || !prop.isKind(SyntaxKind.PropertyAssignment)) return null;
  const init = (prop as PropertyAssignment).getInitializer();
  if (!init) return null;
  if (init.isKind(SyntaxKind.StringLiteral)) return init.getLiteralValue();
  if (init.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)) return init.getLiteralValue();
  return null;
}

/** オブジェクトリテラルから数値プロパティを取得 */
export function getNumberProp(obj: ObjectLiteralExpression, key: string): number | null {
  const prop = obj.getProperty(key);
  if (!prop || !prop.isKind(SyntaxKind.PropertyAssignment)) return null;
  const init = (prop as PropertyAssignment).getInitializer();
  if (!init) return null;
  if (init.isKind(SyntaxKind.NumericLiteral)) return init.getLiteralValue();
  // 負数: PrefixUnaryExpression(-1) 対応
  if (init.isKind(SyntaxKind.PrefixUnaryExpression)) {
    const text = init.getText();
    const n = Number(text);
    if (!isNaN(n)) return n;
  }
  return null;
}

/** オブジェクトリテラルから boolean プロパティを取得 */
export function getBoolProp(obj: ObjectLiteralExpression, key: string): boolean | null {
  const prop = obj.getProperty(key);
  if (!prop || !prop.isKind(SyntaxKind.PropertyAssignment)) return null;
  const init = (prop as PropertyAssignment).getInitializer();
  if (!init) return null;
  if (init.isKind(SyntaxKind.TrueKeyword)) return true;
  if (init.isKind(SyntaxKind.FalseKeyword)) return false;
  return null;
}

/** オブジェクトリテラルから文字列または数値を文字列として取得 */
export function getStringOrNumberProp(obj: ObjectLiteralExpression, key: string): string | null {
  const s = getStringProp(obj, key);
  if (s !== null) return s;
  const n = getNumberProp(obj, key);
  if (n !== null) return String(n);
  return null;
}

/** オブジェクトリテラルから配列プロパティを取得 */
export function getArrayProp(obj: ObjectLiteralExpression, key: string): ArrayLiteralExpression | null {
  const prop = obj.getProperty(key);
  if (!prop || !prop.isKind(SyntaxKind.PropertyAssignment)) return null;
  const init = (prop as PropertyAssignment).getInitializer();
  if (!init) return null;
  // 直接配列リテラル
  if (init.isKind(SyntaxKind.ArrayLiteralExpression)) return init as ArrayLiteralExpression;
  // 変数参照を解決
  if (init.isKind(SyntaxKind.Identifier)) {
    return resolveIdentifierToArray(init.getSourceFile(), init.getText());
  }
  return null;
}

/** オブジェクトリテラルからネストされたオブジェクトプロパティを取得 */
export function getObjectProp(obj: ObjectLiteralExpression, key: string): ObjectLiteralExpression | null {
  const prop = obj.getProperty(key);
  if (!prop || !prop.isKind(SyntaxKind.PropertyAssignment)) return null;
  const init = (prop as PropertyAssignment).getInitializer();
  if (!init || !init.isKind(SyntaxKind.ObjectLiteralExpression)) return null;
  return init as ObjectLiteralExpression;
}

/** { value: string, label: string }[] 配列をパース */
export function parseOptionsArray(arr: ArrayLiteralExpression): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  for (const el of arr.getElements()) {
    if (!el.isKind(SyntaxKind.ObjectLiteralExpression)) continue;
    const obj = el as ObjectLiteralExpression;
    const value = getStringProp(obj, "value");
    const label = getStringProp(obj, "label");
    if (value !== null && label !== null) options.push({ value, label });
  }
  return options;
}

/** 識別子名から変数の初期化子の ArrayLiteralExpression を解決 */
function resolveIdentifierToArray(sf: SourceFile, name: string): ArrayLiteralExpression | null {
  for (const decl of sf.getVariableDeclarations()) {
    if (decl.getName() === name) {
      const init = decl.getInitializer();
      if (init?.isKind(SyntaxKind.ArrayLiteralExpression)) return init as ArrayLiteralExpression;
    }
  }
  return null;
}

// ─── schema.ts パーサー ────────────────────

export interface FieldDef {
  name: string;
  goName: string;
  goType: string;
  dbColumn: string;
  isNotNull: boolean;
  isPrimaryKey: boolean;
  hasDefault: boolean;
}

export interface EntityDef {
  tableName: string;
  structName: string;
  fields: FieldDef[];
}

export function toPascalCase(s: string): string {
  if (/[\u3000-\u9FFF\uFF00-\uFFEF]/.test(s)) return s;
  return s.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}

function pgTypeToGoType(colType: string, isNotNull: boolean): string {
  const base: Record<string, string> = {
    serial: "int",
    integer: "int",
    varchar: "string",
    numeric: "string",
    timestamp: "time.Time",
    date: "string",
  };
  const go = base[colType] || "string";
  if (!isNotNull && go === "string") return "sql.NullString";
  return go;
}

/** src/db/schema.ts をパースしてテーブル定義を抽出 */
export function parseSchemaFile(schemaPath: string): Map<string, EntityDef> {
  const sf = getSourceFile(schemaPath);
  const entities = new Map<string, EntityDef>();

  // pgTable("テーブル名", { ... }) の CallExpression を全て検索
  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expr = call.getExpression();
    if (expr.getText() !== "pgTable") continue;

    const args = call.getArguments();
    if (args.length < 2) continue;

    // 第1引数: テーブル名
    const tableNameArg = args[0];
    if (!tableNameArg.isKind(SyntaxKind.StringLiteral)) continue;
    const tableName = tableNameArg.getLiteralValue();

    // 第2引数: カラム定義オブジェクト
    const columnsArg = args[1];
    if (!columnsArg.isKind(SyntaxKind.ObjectLiteralExpression)) continue;

    const fields = parseTableFieldsFromAST(columnsArg as ObjectLiteralExpression);
    entities.set(tableName, {
      tableName,
      structName: toPascalCase(tableName) + "Row",
      fields,
    });
  }

  return entities;
}

function parseTableFieldsFromAST(obj: ObjectLiteralExpression): FieldDef[] {
  const fields: FieldDef[] = [];

  for (const prop of obj.getProperties()) {
    if (!prop.isKind(SyntaxKind.PropertyAssignment)) continue;
    const pa = prop as PropertyAssignment;
    const fieldName = pa.getName();
    const init = pa.getInitializer();
    if (!init) continue;

    // serial("col"), varchar("col", opts), integer("col"), etc. を解析
    // メソッドチェーンの根本にある CallExpression を取得
    const { rootCall, chainText } = extractRootCallAndChain(init);
    if (!rootCall) continue;

    const callee = rootCall.getExpression();
    if (!callee.isKind(SyntaxKind.Identifier)) continue;
    const colType = callee.getText();

    const validTypes = new Set(["serial", "varchar", "integer", "numeric", "timestamp", "date"]);
    if (!validTypes.has(colType)) continue;

    const callArgs = rootCall.getArguments();
    if (callArgs.length < 1) continue;
    const dbColumnArg = callArgs[0];
    if (!dbColumnArg.isKind(SyntaxKind.StringLiteral)) continue;
    const dbColumn = dbColumnArg.getLiteralValue();

    const isPK = chainText.includes(".primaryKey()");
    const isNotNull = chainText.includes(".notNull()") || isPK;
    const hasDefault = chainText.includes(".default(") || chainText.includes(".defaultNow()") || isPK;

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

/** メソッドチェーンの根元の CallExpression とチェーン全体テキストを取得 */
function extractRootCallAndChain(node: Node): { rootCall: CallExpression | null; chainText: string } {
  const fullText = node.getText();
  // 最も深い（最初の）CallExpression を見つける
  const calls = node.getDescendantsOfKind(SyntaxKind.CallExpression);
  if (calls.length === 0) {
    // node 自体が CallExpression の場合
    if (node.isKind(SyntaxKind.CallExpression)) {
      return { rootCall: node as CallExpression, chainText: fullText };
    }
    return { rootCall: null, chainText: fullText };
  }
  // 最も深い CallExpression（チェーンの根本）を返す
  const rootCall = calls[calls.length - 1];
  return { rootCall, chainText: fullText };
}

// ─── config.ts パーサー ────────────────────

export interface ColumnDef {
  key: string;
  label: string;
  type: string;
  required: boolean;
  format: boolean;
  options: { value: string; label: string }[];
  expression: string;
  min?: number;
  defaultValue: string;
  placeholder: string;
}

export interface SearchFieldDef {
  searchType: "text" | "date" | "select";
  param: string;
  label: string;
  placeholder: string;
  flexClass: string;
  dbColumns: string[];
  options: { value: string; label: string }[];
}

export interface EntityConfigDef {
  idPrefix: string;
  baseUrl: string;
  bodyTargetId: string;
  paginationId: string;
  formTitle: string;
  emptyMessage: string;
  deleteConfirmTemplate: string;
  searchFields: SearchFieldDef[];
  searchContainerId: string;
}

/** config.ts のカラム定義とエンティティ設定をパース */
export function parseConfigFile(configPath: string): { columns: ColumnDef[]; entity: EntityConfigDef } | null {
  const sf = getSourceFile(configPath);

  const columns = parseColumnsFromAST(sf);
  const entity = parseEntityConfigFromAST(sf);
  return { columns, entity };
}

/** SourceFile から Column[] 配列を検索してパース */
function parseColumnsFromAST(sf: SourceFile): ColumnDef[] {
  // 方法1: `Column[]` 型注釈を持つ変数宣言を探す
  for (const decl of sf.getVariableDeclarations()) {
    const typeNode = decl.getTypeNode();
    if (typeNode && typeNode.getText() === "Column[]") {
      const init = decl.getInitializer();
      if (init?.isKind(SyntaxKind.ArrayLiteralExpression)) {
        return parseColumnArray(init as ArrayLiteralExpression, sf);
      }
    }
  }

  // 方法2: Column[] を返す関数を探す
  for (const func of sf.getFunctions()) {
    const returnType = func.getReturnTypeNode();
    if (returnType && returnType.getText() === "Column[]") {
      // return 文の配列リテラルを探す
      const returnStmts = func.getDescendantsOfKind(SyntaxKind.ReturnStatement);
      for (const ret of returnStmts) {
        const expr = ret.getExpression();
        if (expr?.isKind(SyntaxKind.ArrayLiteralExpression)) {
          return parseColumnArray(expr as ArrayLiteralExpression, sf);
        }
      }
    }
  }

  return [];
}

/** ArrayLiteralExpression から ColumnDef[] をパース */
function parseColumnArray(arr: ArrayLiteralExpression, sf: SourceFile): ColumnDef[] {
  const columns: ColumnDef[] = [];
  for (const el of arr.getElements()) {
    if (!el.isKind(SyntaxKind.ObjectLiteralExpression)) continue;
    const col = parseColumnObjectFromAST(el as ObjectLiteralExpression, sf);
    if (col) columns.push(col);
  }
  return columns;
}

/** 1つの Column オブジェクトリテラルをパース */
function parseColumnObjectFromAST(obj: ObjectLiteralExpression, sf: SourceFile): ColumnDef | null {
  const key = getStringProp(obj, "key");
  const label = getStringProp(obj, "label");
  const type = getStringProp(obj, "type") || "text";

  // deleteAction の場合は label が空文字列の場合がある
  if (!key || (label === null && type !== "deleteAction")) return null;

  const required = getBoolProp(obj, "required") === true;
  const format = getBoolProp(obj, "format") === true;
  const expression = getStringProp(obj, "expression") || "";
  const placeholder = getStringProp(obj, "placeholder") || "";
  const defaultValue = getStringOrNumberProp(obj, "defaultValue") || "";
  const min = getNumberProp(obj, "min") ?? undefined;

  // options をパース（配列リテラルまたは変数参照）
  let options: { value: string; label: string }[] = [];
  const optArr = getArrayProp(obj, "options");
  if (optArr) {
    options = parseOptionsArray(optArr);
  }

  return { key, label: label ?? "", type, required, format, options, expression, min, defaultValue, placeholder };
}

/** SourceFile から EntityConfig オブジェクトを検索してパース */
function parseEntityConfigFromAST(sf: SourceFile): EntityConfigDef {
  // EntityConfig 型注釈を持つ変数宣言を探す
  for (const decl of sf.getVariableDeclarations()) {
    const typeNode = decl.getTypeNode();
    if (typeNode && typeNode.getText() === "EntityConfig") {
      const init = decl.getInitializer();
      if (init?.isKind(SyntaxKind.ObjectLiteralExpression)) {
        return extractEntityConfigFromObj(init as ObjectLiteralExpression, sf);
      }
    }
  }

  // フォールバック: デフォルト値
  return defaultEntityConfig("row");
}

function extractEntityConfigFromObj(obj: ObjectLiteralExpression, sf: SourceFile): EntityConfigDef {
  const idPrefix = getStringProp(obj, "idPrefix") || "row";

  const searchFields = parseSearchFieldsFromAST(obj, sf);

  return {
    idPrefix,
    baseUrl: getStringProp(obj, "baseUrl") || "/api/unknown",
    bodyTargetId: getStringProp(obj, "bodyTargetId") || "data-body",
    paginationId: getStringProp(obj, "paginationId") || "data-pagination",
    formTitle: getStringProp(obj, "formTitle") || "新規登録",
    emptyMessage: getStringProp(obj, "emptyMessage") || "データがありません",
    deleteConfirmTemplate: getStringProp(obj, "deleteConfirmTemplate") || "削除しますか？",
    searchFields,
    searchContainerId: getStringProp(obj, "searchContainerId") || `${idPrefix}-search`,
  };
}

function defaultEntityConfig(idPrefix: string): EntityConfigDef {
  return {
    idPrefix,
    baseUrl: "/api/unknown",
    bodyTargetId: "data-body",
    paginationId: "data-pagination",
    formTitle: "新規登録",
    emptyMessage: "データがありません",
    deleteConfirmTemplate: "削除しますか？",
    searchFields: [],
    searchContainerId: `${idPrefix}-search`,
  };
}

/** searchFields 配列をパース */
function parseSearchFieldsFromAST(parentObj: ObjectLiteralExpression, sf: SourceFile): SearchFieldDef[] {
  const arr = getArrayProp(parentObj, "searchFields");
  if (!arr) return [];

  const fields: SearchFieldDef[] = [];
  for (const el of arr.getElements()) {
    if (!el.isKind(SyntaxKind.ObjectLiteralExpression)) continue;
    const obj = el as ObjectLiteralExpression;

    const searchType = getStringProp(obj, "searchType") as "text" | "date" | "select" | null;
    const param = getStringProp(obj, "param");
    const label = getStringProp(obj, "label");
    if (!searchType || !param || !label) continue;

    // dbColumns
    const dbColumns: string[] = [];
    const dbColArr = getArrayProp(obj, "dbColumns");
    if (dbColArr) {
      for (const colEl of dbColArr.getElements()) {
        if (colEl.isKind(SyntaxKind.StringLiteral)) {
          dbColumns.push(colEl.getLiteralValue());
        }
      }
    }

    // options
    let options: { value: string; label: string }[] = [];
    const optArr = getArrayProp(obj, "options");
    if (optArr) {
      options = parseOptionsArray(optArr);
    }

    fields.push({
      searchType,
      param,
      label,
      placeholder: getStringProp(obj, "placeholder") || "",
      flexClass: getStringProp(obj, "flexClass") || "",
      dbColumns,
      options,
    });
  }
  return fields;
}

// ─── gen-go.config.ts (HeaderBody) パーサー ────────────────────

export interface HeaderBodyChildDef {
  tableName: string;
  sectionLabel: string;
  discriminatorColumn?: string;
  discriminatorValue?: string;
  columns: ColumnDef[];
}

export interface HeaderBodyDef {
  headerColumns: ColumnDef[];
  children: HeaderBodyChildDef[];
  entityConfig: EntityConfigDef;
}

/** gen-go.config.ts から header-body 設定をパース */
export function parseHeaderBodyConfig(configPath: string, featureName: string): HeaderBodyDef | null {
  const sf = getSourceFile(configPath);

  // HeaderBodyConfig 型注釈を持つ変数宣言を探す
  let configObj: ObjectLiteralExpression | null = null;
  for (const decl of sf.getVariableDeclarations()) {
    const typeNode = decl.getTypeNode();
    if (typeNode && typeNode.getText() === "HeaderBodyConfig") {
      const init = decl.getInitializer();
      if (init?.isKind(SyntaxKind.ObjectLiteralExpression)) {
        configObj = init as ObjectLiteralExpression;
        break;
      }
    }
  }
  if (!configObj) return null;

  // type: "header-body" の確認
  const typeVal = getStringProp(configObj, "type");
  if (typeVal !== "header-body") return null;

  // EntityConfig 部分
  const idPrefix = getStringProp(configObj, "idPrefix") || "row";
  const entityConfig: EntityConfigDef = {
    idPrefix,
    baseUrl: getStringProp(configObj, "baseUrl") || `/api/${featureName}`,
    bodyTargetId: getStringProp(configObj, "bodyTargetId") || "data-body",
    paginationId: getStringProp(configObj, "paginationId") || "data-pagination",
    formTitle: getStringProp(configObj, "formTitle") || `新規${featureName}登録`,
    emptyMessage: getStringProp(configObj, "emptyMessage") || `${featureName}がありません`,
    deleteConfirmTemplate: getStringProp(configObj, "deleteConfirmTemplate") || "削除しますか？",
    searchFields: parseSearchFieldsFromAST(configObj, sf),
    searchContainerId: getStringProp(configObj, "searchContainerId") || `${idPrefix}-search`,
  };

  // headerColumns
  const headerColumnsArr = getArrayProp(configObj, "headerColumns");
  const headerColumns: ColumnDef[] = [];
  if (headerColumnsArr) {
    for (const el of headerColumnsArr.getElements()) {
      if (!el.isKind(SyntaxKind.ObjectLiteralExpression)) continue;
      const col = parseColumnObjectFromAST(el as ObjectLiteralExpression, sf);
      if (col) headerColumns.push(col);
    }
  }

  // children
  const childrenArr = getArrayProp(configObj, "children");
  const children: HeaderBodyChildDef[] = [];
  if (childrenArr) {
    for (const el of childrenArr.getElements()) {
      if (!el.isKind(SyntaxKind.ObjectLiteralExpression)) continue;
      const childObj = el as ObjectLiteralExpression;

      const childTableName = getStringProp(childObj, "tableName");
      const sectionLabel = getStringProp(childObj, "sectionLabel");
      if (!childTableName || !sectionLabel) continue;

      // discriminator
      let discriminatorColumn: string | undefined;
      let discriminatorValue: string | undefined;
      const discObj = getObjectProp(childObj, "discriminator");
      if (discObj) {
        discriminatorColumn = getStringProp(discObj, "column") || undefined;
        const numVal = getNumberProp(discObj, "value");
        const strVal = getStringProp(discObj, "value");
        discriminatorValue = numVal !== null ? String(numVal) : strVal || undefined;
      }

      // child columns
      const childCols: ColumnDef[] = [];
      const colsArr = getArrayProp(childObj, "columns");
      if (colsArr) {
        for (const colEl of colsArr.getElements()) {
          if (!colEl.isKind(SyntaxKind.ObjectLiteralExpression)) continue;
          const col = parseColumnObjectFromAST(colEl as ObjectLiteralExpression, sf);
          if (col) childCols.push(col);
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

// ─── extractTableNameFromFeature (config.ts / gen-go.config.ts) ─────

/** config.ts または gen-go.config.ts から tableName を抽出 */
export function extractTableNameFromFeature(configPath: string | null, genConfigPath: string | null): string | null {
  // 1. config.ts — EntityConfig の tableName
  if (configPath) {
    const sf = getSourceFile(configPath);
    for (const decl of sf.getVariableDeclarations()) {
      const typeNode = decl.getTypeNode();
      if (typeNode && typeNode.getText() === "EntityConfig") {
        const init = decl.getInitializer();
        if (init?.isKind(SyntaxKind.ObjectLiteralExpression)) {
          const name = getStringProp(init as ObjectLiteralExpression, "tableName");
          if (name) return name;
        }
      }
    }
    // フォールバック: 型注釈なしの場合も tableName プロパティを探す
    for (const decl of sf.getVariableDeclarations()) {
      const init = decl.getInitializer();
      if (init?.isKind(SyntaxKind.ObjectLiteralExpression)) {
        const name = getStringProp(init as ObjectLiteralExpression, "tableName");
        if (name) return name;
      }
    }
  }

  // 2. gen-go.config.ts — export const tableName = "..."  or HeaderBodyConfig
  if (genConfigPath) {
    const sf = getSourceFile(genConfigPath);
    // `export const tableName = "BOM"` 形式
    for (const decl of sf.getVariableDeclarations()) {
      if (decl.getName() === "tableName") {
        const init = decl.getInitializer();
        if (init?.isKind(SyntaxKind.StringLiteral)) return init.getLiteralValue();
      }
    }
    // HeaderBodyConfig の tableName プロパティ
    for (const decl of sf.getVariableDeclarations()) {
      const typeNode = decl.getTypeNode();
      if (typeNode && typeNode.getText() === "HeaderBodyConfig") {
        const init = decl.getInitializer();
        if (init?.isKind(SyntaxKind.ObjectLiteralExpression)) {
          const name = getStringProp(init as ObjectLiteralExpression, "tableName");
          if (name) return name;
        }
      }
    }
  }

  return null;
}
