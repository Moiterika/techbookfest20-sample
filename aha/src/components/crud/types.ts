/** CRUD 共通コンポーネントで使うカラム定義 */

/** 基本カラムプロパティ */
interface ColumnBase {
  key: string;
  label: string;
  /** PandaCSS の w トークン値 */
  width?: string;
  /** PandaCSS の minW トークン値（編集行の最小幅） */
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

/** 品目タイプアヘッド選択 */
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

export type Column =
  | TextColumn
  | NumberColumn
  | DateColumn
  | BarcodeColumn
  | ItemCodeColumn
  | ReadonlyLookupColumn
  | ComputedColumn
  | SelectColumn
  | ActionsColumn;

/** エンティティ固有の設定 */
export interface EntityConfig {
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
