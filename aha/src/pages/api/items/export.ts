import type { APIRoute } from "astro";
import { db } from "../../../db";
import { items } from "../../../db/schema";
import { and, desc, ilike, or } from "drizzle-orm";
import * as XLSX from "xlsx";

const HEADERS = ["品目コード", "品目名", "カテゴリ", "単価", "バーコード"];

/** GET /api/items/export?format=csv|tsv|xlsx&q=... */
export const GET: APIRoute = async ({ url }) => {
  const format = url.searchParams.get("format") || "csv";
  const query = (url.searchParams.get("q") || "").trim();
  const category = (url.searchParams.get("category") || "").trim();

  const conditions = [];
  if (query) {
    conditions.push(
      or(ilike(items.code, `%${query}%`), ilike(items.name, `%${query}%`)),
    );
  }
  if (category) {
    conditions.push(ilike(items.category, `%${category}%`));
  }
  const searchFilter = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(items)
    .where(searchFilter)
    .orderBy(desc(items.id));

  const data: (string | number)[][] = [
    HEADERS,
    ...rows.map((r) => [
      r.code,
      r.name,
      r.category ?? "",
      r.price,
      r.barcode ?? "",
    ]),
  ];

  const suffix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  if (format === "xlsx") return xlsxResponse(data, `items_${suffix}.xlsx`);
  if (format === "tsv") return textResponse(data, "\t", `items_${suffix}.tsv`);
  return textResponse(data, ",", `items_${suffix}.csv`);
};

function textResponse(
  data: (string | number)[][],
  sep: string,
  filename: string,
) {
  const isCsv = sep === ",";
  const text = data
    .map((row) =>
      row
        .map((c) => {
          const s = String(c);
          return isCsv && /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(sep),
    )
    .join("\n");

  const mime = isCsv
    ? "text/csv;charset=utf-8"
    : "text/tab-separated-values;charset=utf-8";
  return new Response("\uFEFF" + text, {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function xlsxResponse(data: (string | number)[][], filename: string) {
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Response(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
