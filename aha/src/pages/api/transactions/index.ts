import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { db } from "../../../db";
import { transactions, items, transactionTypes } from "../../../db/schema";
import { and, count, desc, eq, gte, inArray, lte } from "drizzle-orm";
import CrudRows from "../../../components/crud/CrudRows.astro";
import {
  getTxColumns,
  fetchTxTypeOptions,
  txEntity,
} from "../../../features/transactions";
import { errorText } from "../../../styles/common.css";

const container = await AstroContainer.create();
const PAGE_SIZES = [20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;

/** 日付フィルタを構築 */
function buildDateFilter(dateFrom?: string, dateTo?: string) {
  const conditions = [];
  if (dateFrom) conditions.push(gte(transactions.date, dateFrom));
  if (dateTo) conditions.push(lte(transactions.date, dateTo));
  return conditions.length > 0 ? and(...conditions) : undefined;
}

/** ページネーション付きで取引一覧 HTML を返す */
async function renderTransactionPage(
  page: number,
  pageSize: number,
  dateFrom?: string,
  dateTo?: string,
) {
  const size = PAGE_SIZES.includes(pageSize as any)
    ? pageSize
    : DEFAULT_PAGE_SIZE;

  const dateFilter = buildDateFilter(dateFrom, dateTo);

  const [{ total }] = await db
    .select({ total: count() })
    .from(transactions)
    .where(dateFilter);
  const totalPages = Math.max(1, Math.ceil(total / size));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const rows = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      transactionTypeId: transactions.transactionTypeId,
      itemId: transactions.itemId,
      unitPrice: transactions.unitPrice,
      quantity: transactions.quantity,
      amount: transactions.amount,
      createdAt: transactions.createdAt,
      updatedAt: transactions.updatedAt,
      itemCode: items.code,
      itemName: items.name,
    })
    .from(transactions)
    .leftJoin(items, eq(transactions.itemId, items.id))
    .where(dateFilter)
    .orderBy(desc(transactions.id))
    .limit(size)
    .offset((currentPage - 1) * size);

  const extraParams: Record<string, string> = {};
  if (dateFrom) extraParams.dateFrom = dateFrom;
  if (dateTo) extraParams.dateTo = dateTo;

  const txTypeOptions = await fetchTxTypeOptions();
  const txColumns = getTxColumns(txTypeOptions);

  const html = await container.renderToString(CrudRows, {
    props: {
      records: rows,
      columns: txColumns,
      entity: txEntity,
      currentPage,
      totalPages,
      pageSize: size,
      extraParams,
    },
  });
  return new Response(html, { headers: { "Content-Type": "text/html" } });
}

/** GET /api/transactions — 取引一覧を HTML 断片で返す */
export const GET: APIRoute = async ({ url }) => {
  const page = Number(url.searchParams.get("page")) || 1;
  const size = Number(url.searchParams.get("size")) || DEFAULT_PAGE_SIZE;
  const dateFrom = url.searchParams.get("dateFrom") || "";
  const dateTo = url.searchParams.get("dateTo") || "";
  return renderTransactionPage(page, size, dateFrom, dateTo);
};

/** POST /api/transactions — 取引を追加し、一覧（1ページ目）を返す */
export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const date = form.get("date") as string;
  const transactionTypeId = Number(form.get("transactionTypeId")) || null;
  const itemId = Number(form.get("itemId"));
  const unitPrice = Number(form.get("unitPrice")) || 0;
  const quantity = Number(form.get("quantity")) || 1;

  if (!date) {
    return new Response(`<p class="${errorText}">日付は必須です</p>`, {
      status: 422,
      headers: { "Content-Type": "text/html" },
    });
  }
  if (!transactionTypeId) {
    return new Response(
      `<p class="${errorText}">取引区分を選択してください</p>`,
      { status: 422, headers: { "Content-Type": "text/html" } },
    );
  }
  if (!itemId) {
    return new Response(`<p class="${errorText}">品目を選択してください</p>`, {
      status: 422,
      headers: { "Content-Type": "text/html" },
    });
  }

  const amount = unitPrice * quantity;
  await db
    .insert(transactions)
    .values({ date, transactionTypeId, itemId, unitPrice, quantity, amount });

  const url = new URL(request.url);
  const size = Number(url.searchParams.get("size")) || DEFAULT_PAGE_SIZE;
  const resp = await renderTransactionPage(1, size);
  resp.headers.set(
    "HX-Trigger",
    JSON.stringify({ "show-toast": "登録しました" }),
  );
  return resp;
};

/** DELETE /api/transactions — 選択された取引を一括削除 */
export const DELETE: APIRoute = async ({ request }) => {
  const { ids } = (await request.json()) as { ids: string[] };
  const numIds = ids.map(Number).filter((n) => !isNaN(n));
  if (numIds.length === 0) {
    return new Response("", { status: 400 });
  }
  await db.delete(transactions).where(inArray(transactions.id, numIds));
  return new Response("", { status: 200 });
};
