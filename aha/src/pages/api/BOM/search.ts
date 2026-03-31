import type { APIRoute } from "astro";
import { db } from "../../../db";
import { BOMテーブル } from "../../../db/schema";
import { ilike, or, asc } from "drizzle-orm";
const dropdownItem =
  "px-3 py-2 text-sm cursor-pointer hover:bg-surface-container-low";

const noResult = "px-3 py-2 text-sm text-outline";

/** GET /api/BOM/search?q=... — BOMをコード・名前で検索し候補リストHTMLを返す */
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
      id: BOMテーブル.id,
      code: BOMテーブル.コード,
      version: BOMテーブル.版,
      name: BOMテーブル.名称,
    })
    .from(BOMテーブル)
    .where(
      or(
        ilike(BOMテーブル.コード, `%${q}%`),
        ilike(BOMテーブル.名称, `%${q}%`),
      ),
    )
    .orderBy(asc(BOMテーブル.コード))
    .limit(10);

  if (rows.length === 0) {
    return new Response(
      `<li class="${noResult}">該当するBOMがありません</li>`,
      { headers: { "Content-Type": "text/html" } },
    );
  }

  const html = rows
    .map(
      (r) =>
        `<li class="${dropdownItem}" ` +
        `data-bom-code="${escapeHtml(r.code)}" ` +
        `data-bom-version="${escapeHtml(r.version)}" ` +
        `data-bom-name="${escapeHtml(r.name)}" ` +
        `@click="line.refBomCode = '${escapeJs(r.code)}'; ` +
        `line.refBomVersion = '${escapeJs(r.version)}'; ` +
        `line.bomSearchOpen = false">` +
        `<strong>${escapeHtml(r.code)}</strong> v${escapeHtml(r.version)} ${escapeHtml(r.name)}</li>`,
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

function escapeJs(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
