import type { APIRoute } from "astro";
import { db } from "../../../db";
import { 取引テーブル, 品目テーブル } from "../../../db/schema";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import * as XLSX from "xlsx";

const HEADERS = ["日付", "品目コード", "品目名", "単価", "数量", "金額"];

/** GET /api/取引/export?format=csv|tsv|xlsx&開始日=...&終了日=... */
export const GET: APIRoute = async ({ url }) => {
  const format = url.searchParams.get("format") || "csv";
  const 開始日 = url.searchParams.get("開始日") || "";
  const 終了日 = url.searchParams.get("終了日") || "";

  const conditions = [];
  if (開始日) conditions.push(gte(取引テーブル.日付, 開始日));
  if (終了日) conditions.push(lte(取引テーブル.日付, 終了日));
  const dateFilter = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      日付: 取引テーブル.日付,
      品目コード: 品目テーブル.コード,
      品目名: 品目テーブル.名称,
      単価: 取引テーブル.単価,
      数量: 取引テーブル.数量,
      金額: 取引テーブル.金額,
    })
    .from(取引テーブル)
    .leftJoin(品目テーブル, eq(取引テーブル.品目ID, 品目テーブル.id))
    .where(dateFilter)
    .orderBy(desc(取引テーブル.id));

  const data: (string | number)[][] = [
    HEADERS,
    ...rows.map((r) => [
      r.日付,
      r.品目コード ?? "",
      r.品目名 ?? "",
      r.単価,
      r.数量,
      r.金額,
    ]),
  ];

  const suffix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  if (format === "xlsx")
    return xlsxResponse(data, `取引_${suffix}.xlsx`);
  if (format === "tsv")
    return textResponse(data, "\t", `取引_${suffix}.tsv`);
  return textResponse(data, ",", `取引_${suffix}.csv`);
};

function textResponse(
  data: (string | number)[][],
  sep: string,
  filename: string,
) {
  const text = data
    .map((row) =>
      row
        .map((c) => {
          const s = String(c);
          return sep === "," && /[,"\n]/.test(s)
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(sep),
    )
    .join("\n");

  const mime =
    sep === ","
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
