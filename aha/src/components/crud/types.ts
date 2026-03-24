/** CRUD 共通コンポーネントで使うカラム定義 */
export interface Column {
  key: string;
  label: string;
  type?: "text" | "number" | "date";
  /** 操作列の幅など（PandaCSS の w トークン値） */
  width?: string;
}
