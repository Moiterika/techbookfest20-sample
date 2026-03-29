import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { db } from "../../../../db";
import { transactions, items } from "../../../../db/schema";
import { eq } from "drizzle-orm";
import CrudRow from "../../../../components/crud/CrudRow.astro";
import {
  getTxColumns,
  fetchTxTypeOptions,
  txEntity,
} from "../../../../features/transactions";
import { errorText } from "../../../../styles/common.css";

const container = await AstroContainer.create();

/** PUT /api/transactions/:id — 取引を更新し、行 HTML を返す */
export const PUT: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
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
    .update(transactions)
    .set({
      date,
      transactionTypeId,
      itemId,
      unitPrice,
      quantity,
      amount,
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, id));

  const [row] = await db
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
    .where(eq(transactions.id, id));

  const txTypeOptions = await fetchTxTypeOptions();
  const txColumns = getTxColumns(txTypeOptions);

  const html = await container.renderToString(CrudRow, {
    props: { record: row, columns: txColumns, entity: txEntity },
  });
  return new Response(html, { headers: { "Content-Type": "text/html" } });
};

/** DELETE /api/transactions/:id — 取引を削除（空レスポンスで行が消える） */
export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  await db.delete(transactions).where(eq(transactions.id, id));
  return new Response("", { headers: { "Content-Type": "text/html" } });
};
