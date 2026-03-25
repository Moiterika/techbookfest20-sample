import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { db } from "../../../../db";
import { transactions, items } from "../../../../db/schema";
import { eq } from "drizzle-orm";
import CrudEditRow from "../../../../components/crud/CrudEditRow.astro";
import { txColumns, txEntity } from "../../../../entities/transactions";

const container = await AstroContainer.create();

/** GET /api/transactions/:id/edit — インライン編集行を返す */
export const GET: APIRoute = async ({ params }) => {
  const id = Number(params.id);

  const [row] = await db
    .select({
      id: transactions.id,
      date: transactions.date,
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

  const html = await container.renderToString(CrudEditRow, {
    props: { record: row, columns: txColumns, entity: txEntity },
  });
  return new Response(html, { headers: { "Content-Type": "text/html" } });
};
