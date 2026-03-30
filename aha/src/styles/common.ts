import { tv } from "tailwind-variants";

// ─── デザインシステムカラー（Architectural Ledger） ─────
// @theme で定義済み（src/index.css 参照）
// primary:           #00288e
// primary-dark:      #1e40af
// surface:           #f9f9ff
// surface-container: #e6eeff
// surface-container-low: #eff3ff
// surface-container-high: #dee9fd
// surface-container-highest: #d9e3f7
// on-surface:        #121c2a
// on-surface-variant:#444653
// outline:           #757684
// outline-variant:   #c4c5d5
// error:             #ba1a1a
// error-container:   #ffdad6
// on-error-container:#93000a

// ─── ボタン（TV でバリアント統一）───────────────────

export const button = tv({
  base: "text-sm py-2 px-4 rounded-lg cursor-pointer font-semibold transition-all duration-200 inline-flex items-center justify-center border-none",
  variants: {
    intent: {
      primary:
        "bg-gradient-to-br from-primary to-primary-dark text-white hover:opacity-90 active:opacity-80",
      secondary:
        "bg-transparent text-primary hover:bg-surface-container-high active:bg-surface-container-highest",
      danger:
        "bg-error/[0.08] text-error hover:bg-error/[0.16] active:bg-error/[0.24]",
    },
  },
  defaultVariants: { intent: "primary" },
});

// ─── フォーム ─────────────────────────────────────

export const input = tv({
  base: "rounded-lg text-sm text-on-surface outline-none bg-surface-container-low border-2 border-transparent transition-[border-color,background-color] duration-200 focus:border-b-primary focus:bg-white",
  variants: {
    size: {
      default: "px-3 py-2.5",
      sm: "py-1.5 px-2.5 w-full min-w-[7.5rem]",
    },
  },
  defaultVariants: { size: "default" },
});

/** フォーム用入力欄 */
export const inputStyle = input({ size: "default" });

/** テーブル行内のコンパクト入力欄 */
export const inputStyleSm = input({ size: "sm" });

/** ラベル（縦並び） */
export const labelStyle =
  "flex flex-col gap-2 text-[0.625rem] font-bold uppercase tracking-wider text-outline";

// ─── カード ───────────────────────────────────────

/** カードコンテナ — トーナルレイヤリング */
export const card = "mb-6 p-6 rounded-xl bg-white";

/** カード内タイトル */
export const cardTitle = "text-lg font-bold text-on-surface mb-4 tracking-tight";

// ─── テーブル ─────────────────────────────────────

/** テーブルヘッダセル */
export const thCell =
  "py-4 px-6 text-[0.625rem] font-bold text-on-surface-variant uppercase tracking-widest";

/** テーブルデータセル */
export const tdCell = "py-4 px-6 text-on-surface-variant text-sm";

/** テーブル行（ホバー＋htmx swapping） */
export const row =
  "transition-all duration-200 ease-in-out hover:bg-surface-container-low [&.htmx-swapping]:opacity-0";

// ─── ユーティリティ ───────────────────────────────

/** 横並びアクションエリア */
export const flexRow = "flex gap-2";

/** エラーテキスト */
export const errorText = "text-error text-sm";

/** ページコンテナ */
export const pageContainer = "max-w-[87.5rem] mx-auto py-8 px-8";

/** ページタイトル */
export const pageTitle =
  "text-2xl font-bold mb-8 text-on-surface tracking-tight";
