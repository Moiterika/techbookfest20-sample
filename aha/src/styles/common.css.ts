import { css } from "../../styled-system/css";

// ─── デザインシステムカラー（Architectural Ledger） ─────
// surface:           #f9f9ff
// surface-container: #e6eeff
// surface-container-low: #eff3ff
// surface-container-high: #dee9fd
// surface-container-highest: #d9e3f7
// surface-container-lowest: #ffffff
// primary:           #00288e
// primary-container: #1e40af
// on-surface:        #121c2a
// on-surface-variant:#444653
// outline:           #757684
// outline-variant:   #c4c5d5
// error:             #ba1a1a
// error-container:   #ffdad6
// on-error-container:#93000a

// ─── ボタン ───────────────────────────────────────

const baseBtn = {
  fontSize: "sm",
  py: "2",
  px: "4",
  rounded: "lg",
  cursor: "pointer",
  fontWeight: "semibold",
  transition: "all 0.2s",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
};

/** プライマリボタン — グラデーション */
export const btnPrimary = css({
  ...baseBtn,
  background: "linear-gradient(135deg, #00288e, #1e40af)",
  color: "white",
  _hover: { opacity: 0.9 },
  _active: { opacity: 0.8 },
});

/** セカンダリボタン — ゴースト */
export const btnSecondary = css({
  ...baseBtn,
  bg: "transparent",
  color: "#00288e",
  _hover: { bg: "#dee9fd" },
  _active: { bg: "#d9e3f7" },
});

/** 危険操作ボタン */
export const btnDanger = css({
  ...baseBtn,
  bg: "rgba(186, 26, 26, 0.08)",
  color: "#ba1a1a",
  _hover: { bg: "rgba(186, 26, 26, 0.16)" },
  _active: { bg: "rgba(186, 26, 26, 0.24)" },
});

// ─── フォーム ─────────────────────────────────────

const baseInput = {
  rounded: "lg",
  fontSize: "sm",
  color: "#121c2a",
  outline: "none",
  bg: "#eff3ff",
  border: "2px solid transparent",
  transition: "border-color 0.2s, background-color 0.2s",
  _focus: {
    borderBottomColor: "#00288e",
    bg: "white",
  },
};

/** フォーム用入力欄 */
export const inputStyle = css({ ...baseInput, px: "3", py: "2.5" });

/** テーブル行内のコンパクト入力欄 */
export const inputStyleSm = css({
  ...baseInput,
  py: "1.5",
  px: "2.5",
  w: "full",
  minW: "7.5rem",
});

/** ラベル（縦並び） */
export const labelStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "2",
  fontSize: "0.625rem",
  fontWeight: "bold",
  textTransform: "uppercase",
  letterSpacing: "wider",
  color: "#757684",
});

// ─── カード ───────────────────────────────────────

/** カードコンテナ — トーナルレイヤリング */
export const card = css({
  mb: "6",
  p: "6",
  rounded: "xl",
  bg: "white",
});

/** カード内タイトル */
export const cardTitle = css({
  fontSize: "lg",
  fontWeight: "bold",
  color: "#121c2a",
  mb: "4",
  letterSpacing: "tight",
});

// ─── テーブル ─────────────────────────────────────

/** テーブルヘッダセル */
export const thCell = css({
  py: "4",
  px: "6",
  fontSize: "0.625rem",
  fontWeight: "bold",
  color: "#444653",
  textTransform: "uppercase",
  letterSpacing: "widest",
});

/** テーブルデータセル */
export const tdCell = css({
  py: "4",
  px: "6",
  color: "#444653",
  fontSize: "sm",
});

/** テーブル行（ホバー＋htmx swapping） */
export const row = css({
  transition: "all 0.2s ease",
  _hover: { bg: "#eff3ff" },
  "&.htmx-swapping": { opacity: 0 },
});

// ─── ユーティリティ ───────────────────────────────

/** 横並びアクションエリア */
export const flexRow = css({ display: "flex", gap: "2" });

/** エラーテキスト */
export const errorText = css({ color: "#ba1a1a", fontSize: "sm" });

/** ページコンテナ */
export const pageContainer = css({
  maxWidth: "87.5rem",
  mx: "auto",
  py: "8",
  px: "8",
});

/** ページタイトル */
export const pageTitle = css({
  fontSize: "1.5rem",
  fontWeight: "bold",
  mb: "8",
  color: "#121c2a",
  letterSpacing: "tight",
});
