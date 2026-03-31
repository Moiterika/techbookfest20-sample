import type { APIRoute } from "astro";
import { db } from "../../../db";
import { 取引区分テーブル } from "../../../db/schema";
import { and, desc, ilike, or } from "drizzle-orm";
import * as XLSX from "xlsx";

const HEADERS = ["取引区分コード", "取引区分名称", "受払係数"];

/** GET /api/取引区分/export?format=csv|tsv|xlsx&q=... */
export const GET: APIRoute = async ({ url }) => {
  const format = url.searchParams.get("format") || "csv";
  const query = (url.searchParams.get("q") || "").trim();

  const conditions = [];
  if (query) {
    conditions.push(
      or(
        ilike(取引区分テーブル.コード, `%${query}%`),
        ilike(取引区分テーブル.名称, `%${query}%`),
      ),
    );
  }
  const searchFilter = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(取引区分テーブル)
    .where(searchFilter)
    .orderBy(desc(取引区分テーブル.id));

  const data: (string | number)[][] = [
    HEADERS,
    ...rows.map((r) => [r.コード, r.名称, r.係数]),
  ];

  const suffix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  if (format === "xlsx")
    return xlsxResponse(data, `取引区分_${suffix}.xlsx`);
  if (format === "tsv")
    return textResponse(data, "\t", `取引区分_${suffix}.tsv`);
  return textResponse(data, ",", `取引区分_${suffix}.csv`);
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
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
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
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
