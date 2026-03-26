import { css } from "../../../styled-system/css";

export const dropdown = css({
  position: "absolute",
  zIndex: 10,
  w: "full",
  mt: "1",
  bg: "white",
  rounded: "lg",
  boxShadow: "0 10px 30px -5px rgba(18, 28, 42, 0.08)",
  maxH: "200px",
  overflowY: "auto",
});

export const selectedRow = css({
  display: "flex",
  alignItems: "center",
  gap: "2",
});

export const badge = css({
  display: "inline-flex",
  alignItems: "center",
  gap: "1",
  px: "2.5",
  py: "1",
  rounded: "full",
  fontSize: "sm",
  fontWeight: "semibold",
  color: "#00288e",
  bg: "#dee9fd",
  whiteSpace: "nowrap",
  flexShrink: 0,
});

export const badgeClear = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  w: "4",
  h: "4",
  rounded: "full",
  fontSize: "xs",
  lineHeight: "1",
  color: "#00288e",
  cursor: "pointer",
  border: "none",
  bg: "transparent",
  _hover: { bg: "rgba(0, 40, 142, 0.15)" },
});

export const nameLabel = css({
  fontSize: "sm",
  color: "#444653",
  whiteSpace: "nowrap",
});
