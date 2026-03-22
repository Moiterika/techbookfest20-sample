import { css } from "../../styled-system/css";

// ─── ボタン ───────────────────────────────────────

const baseBtn = {
  fontSize: "sm",
  py: "1.5",
  px: "3",
  rounded: "md",
  cursor: "pointer",
  fontWeight: "medium",
  transition: "all 0.2s",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "sm",
};

/** プライマリボタン（indigo） */
export const btnPrimary = css({
  ...baseBtn,
  border: "1px solid",
  borderColor: "transparent",
  bg: "indigo.600",
  color: "white",
  _hover: { bg: "indigo.700" },
  _active: { bg: "indigo.800" },
});

/** セカンダリボタン（白背景＋ボーダー） */
export const btnSecondary = css({
  ...baseBtn,
  border: "1px solid",
  borderColor: "slate.300",
  bg: "white",
  color: "slate.700",
  _hover: { bg: "slate.50", borderColor: "slate.400" },
  _active: { bg: "slate.100" },
});

/** 危険操作ボタン（rose） */
export const btnDanger = css({
  ...baseBtn,
  border: "1px solid",
  borderColor: "transparent",
  bg: "rose.600",
  color: "white",
  _hover: { bg: "rose.700" },
  _active: { bg: "rose.800" },
});

// ─── フォーム ─────────────────────────────────────

const baseInput = {
  border: "1px solid",
  borderColor: "slate.300",
  rounded: "md",
  fontSize: "sm",
  color: "slate.900",
  outline: "none",
  transition: "border-color 0.2s, box-shadow 0.2s",
  _focus: {
    borderColor: "indigo.500",
    boxShadow: "0 0 0 1px token(colors.indigo.500)",
  },
};

/** フォーム用入力欄 */
export const inputStyle = css({ ...baseInput, px: "3", py: "2" });

/** テーブル行内のコンパクト入力欄 */
export const inputStyleSm = css({
  ...baseInput,
  py: "1.5",
  px: "2.5",
  w: "full",
});

/** ラベル（縦並び） */
export const labelStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "1.5",
  fontSize: "sm",
  fontWeight: "medium",
  color: "slate.700",
});

// ─── カード ───────────────────────────────────────

/** カードコンテナ */
export const card = css({
  mb: "6",
  p: "6",
  rounded: "xl",
  border: "1px solid",
  borderColor: "slate.200",
  bg: "white",
  boxShadow: "sm",
});

/** カード内タイトル */
export const cardTitle = css({
  fontSize: "lg",
  fontWeight: "semibold",
  color: "slate.900",
  mb: "4",
});

// ─── テーブル ─────────────────────────────────────

/** テーブルヘッダセル */
export const thCell = css({
  py: "3",
  px: "4",
  fontSize: "xs",
  fontWeight: "semibold",
  color: "slate.500",
  textTransform: "uppercase",
  letterSpacing: "wider",
});

/** テーブルデータセル */
export const tdCell = css({
  py: "3",
  px: "4",
  borderBottom: "1px solid",
  borderColor: "slate.200",
  color: "slate.700",
  fontSize: "sm",
});

/** テーブル行（ホバー＋htmx swapping） */
export const row = css({
  transition: "all 0.2s ease",
  _hover: { bg: "slate.50" },
  "&.htmx-swapping": { opacity: 0 },
});

// ─── ユーティリティ ───────────────────────────────

/** 横並びアクションエリア */
export const flexRow = css({ display: "flex", gap: "2" });

/** エラーテキスト */
export const errorText = css({ color: "rose.600", fontSize: "sm" });

/** ページコンテナ */
export const pageContainer = css({
  maxWidth: "800px",
  mx: "auto",
  py: "8",
  px: "4",
});

/** ページタイトル */
export const pageTitle = css({
  fontSize: "2xl",
  fontWeight: "bold",
  mb: "6",
});
