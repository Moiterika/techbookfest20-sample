import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { db } from "../../../../db";
import { transactionTypes } from "../../../../db/schema";
import { eq } from "drizzle-orm";
import {
  取引区分カラム,
  取引区分エンティティ,
} from "../../../../features/取引区分";
// @ts-ignore
import CrudEditRow from "../../../../components/crud/CrudEditRow.astro";

const container = await AstroContainer.create();

/** GET /api/取引区分/:id/edit — インライン編集フォームを HTML 断片で返す */
export const GET: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  const [row] = await db
    .select()
    .from(transactionTypes)
    .where(eq(transactionTypes.id, id));

  if (!row) {
    return new Response("", { status: 404 });
  }

  const html = await container.renderToString(CrudEditRow, {
    props: {
      record: row,
      columns: 取引区分カラム,
      entity: 取引区分エンティティ,
    },
  });
  return new Response(html, { headers: { "Content-Type": "text/html" } });
};
