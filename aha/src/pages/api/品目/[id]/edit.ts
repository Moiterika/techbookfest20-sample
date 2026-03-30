import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { db } from "../../../../db";
import { items } from "../../../../db/schema";
import { eq } from "drizzle-orm";
import { 品目カラム, 品目エンティティ } from "../../../../features/品目";
// @ts-ignore
import CrudEditRow from "../../../../components/crud/CrudEditRow.astro";

const container = await AstroContainer.create();

/** GET /api/品目/:id/edit — インライン編集フォームを HTML 断片で返す */
export const GET: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  const [row] = await db.select().from(items).where(eq(items.id, id));

  if (!row) {
    return new Response("", { status: 404 });
  }

  const html = await container.renderToString(CrudEditRow, {
    props: { record: row, columns: 品目カラム, entity: 品目エンティティ },
  });
  return new Response(html, { headers: { "Content-Type": "text/html" } });
};
