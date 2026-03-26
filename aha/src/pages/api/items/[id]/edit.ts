import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { db } from "../../../../db";
import { items } from "../../../../db/schema";
import { eq } from "drizzle-orm";
import CrudEditRow from "../../../../components/crud/CrudEditRow.astro";
import { itemColumns, itemEntity } from "../../../../features/items";

const container = await AstroContainer.create();

/** GET /api/items/:id/edit — インライン編集フォームを HTML 断片で返す */
export const GET: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  const [row] = await db.select().from(items).where(eq(items.id, id));

  if (!row) {
    return new Response("", { status: 404 });
  }

  const html = await container.renderToString(CrudEditRow, {
    props: { record: row, columns: itemColumns, entity: itemEntity },
  });
  return new Response(html, { headers: { "Content-Type": "text/html" } });
};
