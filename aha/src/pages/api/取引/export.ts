import type { APIRoute } from "astro";
import { db } from "../../../db";
import { transactions, items } from "../../../db/schema";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import * as XLSX from "xlsx";

const HEADERS = ["日付", "品目コード", "品目名", "単価", "数量", "金額"];

/** GET /api/取引/export?format=csv|tsv|xlsx&dateFrom=...&dateTo=... */
export const GET: APIRoute = async ({ url }) => {
  const format = url.searchParams.get("format") || "csv";
  const dateFrom = url.searchParams.get("dateFrom") || "";
  const dateTo = url.searchParams.get("dateTo") || "";

  const conditions = [];
  if (dateFrom) conditions.push(gte(transactions.date, dateFrom));
  if (dateTo) conditions.push(lte(transactions.date, dateTo));
  const dateFilter = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      date: transactions.date,
      itemCode: items.code,
      itemName: items.name,
      unitPrice: transactions.unitPrice,
      quantity: transactions.quantity,
      amount: transactions.amount,
    })
    .from(transactions)
    .leftJoin(items, eq(transactions.itemId, items.id))
    .where(dateFilter)
    .orderBy(desc(transactions.id));

  const data: (string | number)[][] = [
    HEADERS,
    ...rows.map((r) => [
      r.date,
      r.itemCode ?? "",
      r.itemName ?? "",
      r.unitPrice,
      r.quantity,
      r.amount,
    ]),
  ];

  const suffix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  if (format === "xlsx")
    return xlsxResponse(data, `transactions_${suffix}.xlsx`);
  if (format === "tsv")
    return textResponse(data, "\t", `transactions_${suffix}.tsv`);
  return textResponse(data, ",", `transactions_${suffix}.csv`);
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
