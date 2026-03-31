/** CRUD 共通コンポーネントで使うカラム定義 */

// ─── 検索フィールド定義 ───

interface SearchFieldBase {
  /** クエリパラメータ名 (例: "q", "category") */
  param: string;
  /** 表示ラベル */
  label: string;
  /** プレースホルダ */
  placeholder?: string;
  /** Flex レイアウト用クラス (例: "flex-1 min-w-[12.5rem]") */
  flexClass?: string;
}

interface TextSearchField extends SearchFieldBase {
  searchType: "text";
  /** gen-go 用: ILIKE 検索対象カラム (例: ["code", "name"]) */
  dbColumns?: string[];
}

interface DateSearchField extends SearchFieldBase {
  searchType: "date";
}

interface SelectSearchField extends SearchFieldBase {
  searchType: "select";
  options: { value: string; label: string }[];
}

export type SearchField = TextSearchField | DateSearchField | SelectSearchField;

// ─── Typeahead 設定 ───

export interface TypeaheadConfig {
  /** エンティティ名 (例: "品目", "取引区分") — API パス導出に使用 */
  entityName: string;
  /** DB テーブル名 (例: "items") — コード生成で使用 */
  tableName: string;
  /** ILIKE 検索対象カラム (例: ["code", "name"]) */
  searchColumns: string[];
  /** ドロップダウンの表示カラム */
  displayColumns: { key: string; bold?: boolean }[];
  /** バッジに表示するキー (例: "code") */
  badgeDisplayKey: string;
  /** バッジ横の名称ラベルキー (例: "name") */
  nameLabelKey?: string;
  /** 選択時に追加で渡すデータキー (例: ["price"]) */
  extraDataKeys?: string[];
  /** 検索入力のプレースホルダ */
  placeholder?: string;
}

// ─── カラム定義 ───

/** 基本カラムプロパティ */
interface ColumnBase {
  key: string;
  label: string;
  /** Tailwind の width クラス値 */
  width?: string;
  /** Tailwind の min-width クラス値（編集行の最小幅） */
  minWidth?: string;
  /** フォームで必須か */
  required?: boolean;
  /** プレースホルダ */
  placeholder?: string;
  /** 新規登録フォームのデフォルト値 */
  defaultValue?: string | number;
  /** フォーム（新規登録）で非表示にする */
  hideInForm?: boolean;
}

interface TextColumn extends ColumnBase {
  type?: "text";
}

interface NumberColumn extends ColumnBase {
  type: "number";
  /** 表示行で toLocaleString() するか */
  format?: boolean;
  /** Alpine.js x-model 変数名（計算フィールド連動用） */
  alpineModel?: string;
  /** min 属性 */
  min?: number;
}

interface DateColumn extends ColumnBase {
  type: "date";
}

/** バーコード: input + react-barcode ライブプレビュー */
interface BarcodeColumn extends ColumnBase {
  type: "barcode";
}

/** タイプアヘッド選択（汎用） */
interface TypeaheadColumn extends ColumnBase {
  type: "typeahead";
  /** 参照先エンティティ名 (例: "品目", "取引区分") */
  typeaheadEntity: string;
  /** hidden input の name (例: "itemId") */
  valueName?: string;
}

/** @deprecated TypeaheadColumn を使用してください */
interface ItemCodeColumn extends ColumnBase {
  type: "itemCode";
  /** hidden input の name（デフォルト: "itemId"） */
  valueName?: string;
}

/** 参照表示（読み取り専用、フォームでは非表示） */
interface ReadonlyLookupColumn extends ColumnBase {
  type: "readonlyLookup";
}

/** 計算フィールド: Alpine.js 式で算出 */
interface ComputedColumn extends ColumnBase {
  type: "computed";
  /** Alpine.js 式 (例: "unitPrice * quantity") */
  expression: string;
  /** toLocaleString() で整形するか */
  format?: boolean;
}

/** セレクトボックス */
interface SelectColumn extends ColumnBase {
  type: "select";
  /** 選択肢 { value, label } の配列 */
  options: { value: string; label: string }[];
}

/** 操作列 (編集/削除ボタン) */
interface ActionsColumn extends ColumnBase {
  type: "actions";
}

/** 削除ボタン列（header-body の子行用） */
interface DeleteActionColumn extends ColumnBase {
  type: "deleteAction";
}

export type Column =
  | TextColumn
  | NumberColumn
  | DateColumn
  | BarcodeColumn
  | TypeaheadColumn
  | ItemCodeColumn
  | ReadonlyLookupColumn
  | ComputedColumn
  | SelectColumn
  | ActionsColumn
  | DeleteActionColumn;

/** 子エンティティ（明細行）の設定 */
export interface ChildEntityConfig {
  /** 子テーブル名 (例: "bom_lines") */
  tableName: string;
  /** セクション見出し (例: "製造品目（アウトプット）") */
  sectionLabel: string;
  /** 子行のカラム定義 */
  columns: Column[];
  /** 同一テーブルで複数リストを分ける場合の判別カラム */
  discriminator?: {
    column: string;
    value: number | string;
  };
}

/** header-body パターンの設定 */
export interface HeaderBodyConfig extends EntityConfig {
  type: "header-body";
  /** 親エンティティのカラム（ヘッダーフォーム用） */
  headerColumns: Column[];
  /** 子エンティティ定義（1つ or 複数） */
  children: ChildEntityConfig[];
}

/** エンティティ固有の設定 */
export interface EntityConfig {
  /** 検索パネルのフィールド定義。未定義なら検索パネル非表示 */
  searchFields?: SearchField[];
  /** 検索パネルの container ID（デフォルト: `${idPrefix}-search`） */
  searchContainerId?: string;
  /** DB テーブル名 (例: "items", "transactions") — コード生成で使用 */
  tableName: string;
  /** ID プレフィックス (例: "item", "tx") */
  idPrefix: string;
  /** API ベース URL (例: "/api/items") */
  baseUrl: string;
  /** tbody の ID (例: "items-body") */
  bodyTargetId: string;
  /** ページネーション表示先の ID */
  paginationId: string;
  /** 削除確認メッセージ。{name} で displayNameKey の値を埋め込む */
  deleteConfirmTemplate?: string;
  /** 確認ダイアログに使う表示名のキー */
  displayNameKey?: string;
  /** 編集行の Alpine x-data 初期化（record を受け取って文字列を返す） */
  alpineInitEditRow?: (record: Record<string, any>) => string;
  /** フォームカードの Alpine x-data 初期化文字列 */
  alpineInitForm?: string;
  /** フォームカード div への追加 Alpine 属性 */
  formExtraAttrs?: Record<string, string>;
  /** フォーム送信前バリデーション式 */
  formBeforeRequest?: string;
  /** フォーム送信後リセット式 */
  formAfterRequest?: string;
  /** フォームタイトル */
  formTitle: string;
  /** 空一覧のメッセージ */
  emptyMessage: string;
}
