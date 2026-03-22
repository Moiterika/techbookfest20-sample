import { css } from "../../../styled-system/css";

export const btnSm = css({
  fontSize: "sm",
  py: "1",
  px: "3",
  rounded: "sm",
  cursor: "pointer",
  border: "1px solid",
  borderColor: "gray.300",
  bg: "gray.50",
  _hover: { bg: "gray.200" },
});

export const btnPrimary = css({
  fontSize: "sm",
  py: "1",
  px: "3",
  rounded: "sm",
  cursor: "pointer",
  border: "1px solid",
  borderColor: "blue.600",
  bg: "blue.600",
  color: "white",
  _hover: { bg: "blue.700" },
});

export const btnDanger = css({
  fontSize: "sm",
  py: "1",
  px: "3",
  rounded: "sm",
  cursor: "pointer",
  border: "1px solid",
  borderColor: "red.600",
  bg: "red.600",
  color: "white",
  _hover: { bg: "red.700" },
});

export const tdCell = css({
  py: "2",
  px: "3",
  borderBottom: "1px solid",
  borderColor: "gray.200",
});

export const editInput = css({
  border: "1px solid",
  borderColor: "gray.300",
  rounded: "sm",
  py: "0.5",
  px: "1.5",
  w: "full",
});

export const row = css({
  transition: "opacity 0.3s ease",
  "&.htmx-swapping": { opacity: 0 },
});

export const errorText = css({
  color: "red.600",
  fontSize: "sm",
});
