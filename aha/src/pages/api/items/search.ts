import type { APIRoute } from "astro";
import { db } from "../../../db";
import { items } from "../../../db/schema";
import { ilike, or, asc } from "drizzle-orm";
import { css } from "../../../../styled-system/css";

const dropdownItem = css({
  px: "3",
  py: "2",
  fontSize: "sm",
  cursor: "pointer",
  _hover: { bg: "indigo.50" },
});

const noResult = css({
  px: "3",
  py: "2",
  fontSize: "sm",
  color: "slate.400",
});

/** GET /api/items/search?q=... — 品目をコード・名前で検索し候補リストHTMLを返す */
export const GET: APIRoute = async ({ url }) => {
  const q = (url.searchParams.get("q") || "").trim();

  if (!q) {
    return new Response(
      `<li class="${noResult}">検索語を入力してください</li>`,
      { headers: { "Content-Type": "text/html" } },
    );
  }

  const rows = await db
    .select({
      id: items.id,
      code: items.code,
      name: items.name,
      price: items.price,
    })
    .from(items)
    .where(or(ilike(items.code, `%${q}%`), ilike(items.name, `%${q}%`)))
    .orderBy(asc(items.code))
    .limit(10);

  if (rows.length === 0) {
    return new Response(
      `<li class="${noResult}">該当する品目がありません</li>`,
      { headers: { "Content-Type": "text/html" } },
    );
  }

  const html = rows
    .map(
      (r) =>
        `<li class="${dropdownItem}" ` +
        `@click="selectedId = ${r.id}; selectedCode = '${escapeAttr(r.code)}'; selectedName = '${escapeAttr(r.name)}'; q = selectedCode; open = false; $dispatch('item-selected', { price: ${r.price} })">` +
        `<strong>${escapeHtml(r.code)}</strong> ${escapeHtml(r.name)}</li>`,
    )
    .join("");

  return new Response(html, { headers: { "Content-Type": "text/html" } });
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string) {
  return s.replace(/'/g, "\\'").replace(/\\/g, "\\\\");
}
