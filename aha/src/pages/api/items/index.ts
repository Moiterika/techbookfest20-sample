import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { db } from "../../../db";
import { items } from "../../../db/schema";
import { count, desc } from "drizzle-orm";
import ItemRows from "../../../components/items/ItemRows.astro";
import { errorText } from "../../../styles/common.css";

const container = await AstroContainer.create();
const PAGE_SIZES = [20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;

/** ページネーション付きで品目一覧 HTML を返す */
async function renderItemPage(page: number, pageSize: number) {
  const size = PAGE_SIZES.includes(pageSize as any)
    ? pageSize
    : DEFAULT_PAGE_SIZE;
  const [{ total }] = await db.select({ total: count() }).from(items);
  const totalPages = Math.max(1, Math.ceil(total / size));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const rows = await db
    .select()
    .from(items)
    .orderBy(desc(items.id))
    .limit(size)
    .offset((currentPage - 1) * size);

  const html = await container.renderToString(ItemRows, {
    props: { items: rows, currentPage, totalPages, pageSize: size },
  });
  return new Response(html, { headers: { "Content-Type": "text/html" } });
}

/** GET /api/items — 品目一覧を HTML 断片で返す */
export const GET: APIRoute = async ({ url }) => {
  const page = Number(url.searchParams.get("page")) || 1;
  const size = Number(url.searchParams.get("size")) || DEFAULT_PAGE_SIZE;
  return renderItemPage(page, size);
};

/** POST /api/items — 品目を追加し、一覧（1ページ目）を返す */
export const POST: APIRoute = async ({ request }) => {
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

  await db.insert(items).values({ name, category, price, barcode });

  const url = new URL(request.url);
  const size = Number(url.searchParams.get("size")) || DEFAULT_PAGE_SIZE;
  return renderItemPage(1, size);
};
