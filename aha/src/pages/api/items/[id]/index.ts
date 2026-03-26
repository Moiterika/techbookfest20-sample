import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { db } from "../../../../db";
import { items } from "../../../../db/schema";
import { eq } from "drizzle-orm";
import CrudRow from "../../../../components/crud/CrudRow.astro";
import { itemColumns, itemEntity } from "../../../../features/items";
import { errorText } from "../../../../styles/common.css";

const container = await AstroContainer.create();

/** PUT /api/items/:id — 品目を更新し、行 HTML を返す */
export const PUT: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  const form = await request.formData();
  const code = form.get("code") as string;
  const name = form.get("name") as string;
  const category = form.get("category") as string;
  const price = Number(form.get("price")) || 0;
  const barcode = form.get("barcode") as string;

  if (!code || !name) {
    const msg = !code ? "品目コードは必須です" : "品目名は必須です";
    return new Response(`<p class="${errorText}">${msg}</p>`, {
      status: 422,
      headers: { "Content-Type": "text/html" },
    });
  }

  await db
    .update(items)
    .set({ code, name, category, price, barcode, updatedAt: new Date() })
    .where(eq(items.id, id));

  const [row] = await db.select().from(items).where(eq(items.id, id));

  const html = await container.renderToString(CrudRow, {
    props: { record: row, columns: itemColumns, entity: itemEntity },
  });
  return new Response(html, { headers: { "Content-Type": "text/html" } });
};

/** DELETE /api/items/:id — 品目を削除（空レスポンスで行が消える） */
export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  await db.delete(items).where(eq(items.id, id));
  return new Response("", { headers: { "Content-Type": "text/html" } });
};
