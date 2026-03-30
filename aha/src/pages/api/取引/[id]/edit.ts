import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { db } from "../../../../db";
import { transactions, items } from "../../../../db/schema";
import { eq } from "drizzle-orm";
import {
  fetch取引区分オプション,
  get取引カラム,
  取引エンティティ,
} from "../../../../features/取引";
// @ts-ignore
import CrudEditRow from "../../../../components/crud/CrudEditRow.astro";

const container = await AstroContainer.create();

/** GET /api/取引/:id/edit — インライン編集行を返す */
export const GET: APIRoute = async ({ params }) => {
  const id = Number(params.id);

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

  if (!row) {
    return new Response("Not found", { status: 404 });
  }

  const txTypeOptions = await fetch取引区分オプション();
  const 取引カラム = get取引カラム(txTypeOptions);

  const html = await container.renderToString(CrudEditRow, {
    props: { record: row, columns: 取引カラム, entity: 取引エンティティ },
  });
  return new Response(html, { headers: { "Content-Type": "text/html" } });
};
