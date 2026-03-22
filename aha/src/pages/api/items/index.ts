import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { db } from "../../../db";
import { items } from "../../../db/schema";
import { desc } from "drizzle-orm";
import ItemRows from "../../../components/items/ItemRows.astro";
import { errorText } from "../../../styles/common.css";

const container = await AstroContainer.create();

/** GET /api/items — 品目一覧を HTML 断片で返す */
export const GET: APIRoute = async () => {
  const rows = await db.select().from(items).orderBy(desc(items.id));
  const html = await container.renderToString(ItemRows, {
    props: { items: rows },
  });
  return new Response(html, { headers: { "Content-Type": "text/html" } });
};

/** POST /api/items — 品目を追加し、一覧を返す */
export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const name = form.get("name") as string;
  const category = form.get("category") as string;
  const price = Number(form.get("price")) || 0;

  if (!name) {
    return new Response(`<p class="${errorText}">品目名は必須です</p>`, {
      status: 422,
      headers: { "Content-Type": "text/html" },
    });
  }

  await db.insert(items).values({ name, category, price });

  const rows = await db.select().from(items).orderBy(desc(items.id));
  const html = await container.renderToString(ItemRows, {
    props: { items: rows },
  });
  return new Response(html, { headers: { "Content-Type": "text/html" } });
};
