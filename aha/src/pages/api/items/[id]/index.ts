import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { db } from "../../../../db";
import { items } from "../../../../db/schema";
import { eq } from "drizzle-orm";
import ItemRow from "../../../../components/items/ItemRow.astro";
import { errorText } from "../../../../styles/common.css";

const container = await AstroContainer.create();

/** PUT /api/items/:id — 品目を更新し、行 HTML を返す */
export const PUT: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  const form = await request.formData();
  const name = form.get("name") as string;
  const category = form.get("category") as string;
  const price = Number(form.get("price")) || 0;
  const barcode = form.get("barcode") as string;

  if (!name) {
    return new Response(`<p class="${errorText}">品目名は必須です</p>`, {
      status: 422,
      headers: { "Content-Type": "text/html" },
    });
  }

  await db
    .update(items)
    .set({ name, category, price, barcode, updatedAt: new Date() })
    .where(eq(items.id, id));

  const [row] = await db.select().from(items).where(eq(items.id, id));

  const html = await container.renderToString(ItemRow, {
    props: { item: row },
  });
  return new Response(html, { headers: { "Content-Type": "text/html" } });
};

/** DELETE /api/items/:id — 品目を削除（空レスポンスで行が消える） */
export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  await db.delete(items).where(eq(items.id, id));
  return new Response("", { headers: { "Content-Type": "text/html" } });
};
