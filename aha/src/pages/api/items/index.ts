import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { db } from "../../../db";
import { items } from "../../../db/schema";
import { count, desc, ilike, or } from "drizzle-orm";
import ItemRows from "../../../components/items/ItemRows.astro";
import { errorText } from "../../../styles/common.css";

const container = await AstroContainer.create();
const PAGE_SIZES = [20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;

/** ページネーション付きで品目一覧 HTML を返す */
async function renderItemPage(page: number, pageSize: number, query?: string) {
  const size = PAGE_SIZES.includes(pageSize as any)
    ? pageSize
    : DEFAULT_PAGE_SIZE;

  const searchFilter = query
    ? or(
        ilike(items.code, `%${query}%`),
        ilike(items.name, `%${query}%`),
        ilike(items.category, `%${query}%`),
      )
    : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(items)
    .where(searchFilter);
  const totalPages = Math.max(1, Math.ceil(total / size));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const rows = await db
    .select()
    .from(items)
    .where(searchFilter)
    .orderBy(desc(items.id))
    .limit(size)
    .offset((currentPage - 1) * size);

  const html = await container.renderToString(ItemRows, {
    props: {
      items: rows,
      currentPage,
      totalPages,
      pageSize: size,
      query: query || "",
    },
  });
  return new Response(html, { headers: { "Content-Type": "text/html" } });
}

/** GET /api/items — 品目一覧を HTML 断片で返す */
export const GET: APIRoute = async ({ url }) => {
  const page = Number(url.searchParams.get("page")) || 1;
  const size = Number(url.searchParams.get("size")) || DEFAULT_PAGE_SIZE;
  const query = url.searchParams.get("q") || "";
  return renderItemPage(page, size, query);
};

/** POST /api/items — 品目を追加し、一覧（1ページ目）を返す */
export const POST: APIRoute = async ({ request }) => {
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

  await db.insert(items).values({ code, name, category, price, barcode });

  const url = new URL(request.url);
  const size = Number(url.searchParams.get("size")) || DEFAULT_PAGE_SIZE;
  return renderItemPage(1, size);
};
