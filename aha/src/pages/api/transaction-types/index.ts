import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { db } from "../../../db";
import { transactionTypes } from "../../../db/schema";
import { count, desc, inArray } from "drizzle-orm";
import CrudRows from "../../../components/crud/CrudRows.astro";
import {
  txTypeColumns,
  txTypeEntity,
} from "../../../features/transaction-types";
import { errorText } from "../../../styles/common.css";

const container = await AstroContainer.create();
const PAGE_SIZES = [20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;

/** ページネーション付きで取引区分一覧 HTML を返す */
async function renderPage(page: number, pageSize: number) {
  const size = PAGE_SIZES.includes(pageSize as any)
    ? pageSize
    : DEFAULT_PAGE_SIZE;

  const [{ total }] = await db
    .select({ total: count() })
    .from(transactionTypes);
  const totalPages = Math.max(1, Math.ceil(total / size));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const rows = await db
    .select()
    .from(transactionTypes)
    .orderBy(desc(transactionTypes.id))
    .limit(size)
    .offset((currentPage - 1) * size);

  const html = await container.renderToString(CrudRows, {
    props: {
      records: rows,
      columns: txTypeColumns,
      entity: txTypeEntity,
      currentPage,
      totalPages,
      pageSize: size,
      extraParams: {},
    },
  });
  return new Response(html, { headers: { "Content-Type": "text/html" } });
}

/** GET /api/transaction-types — 取引区分一覧を HTML 断片で返す */
export const GET: APIRoute = async ({ url }) => {
  const page = Number(url.searchParams.get("page")) || 1;
  const size = Number(url.searchParams.get("size")) || DEFAULT_PAGE_SIZE;
  return renderPage(page, size);
};

/** POST /api/transaction-types — 取引区分を追加し、一覧（1ページ目）を返す */
export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const code = form.get("code") as string;
  const name = form.get("name") as string;
  const coefficient = Number(form.get("coefficient")) || 0;

  if (!code || !name) {
    const msg = !code ? "取引区分コードは必須です" : "取引区分名称は必須です";
    return new Response(`<p class="${errorText}">${msg}</p>`, {
      status: 422,
      headers: { "Content-Type": "text/html" },
    });
  }

  if (![-1, 0, 1].includes(coefficient)) {
    return new Response(
      `<p class="${errorText}">受払係数は -1, 0, 1 のいずれかです</p>`,
      { status: 422, headers: { "Content-Type": "text/html" } },
    );
  }

  await db.insert(transactionTypes).values({ code, name, coefficient });

  const url = new URL(request.url);
  const size = Number(url.searchParams.get("size")) || DEFAULT_PAGE_SIZE;
  const resp = await renderPage(1, size);
  resp.headers.set(
    "HX-Trigger",
    JSON.stringify({ "show-toast": "登録しました" }),
  );
  return resp;
};

/** DELETE /api/transaction-types — 選択された取引区分を一括削除 */
export const DELETE: APIRoute = async ({ request }) => {
  const { ids } = (await request.json()) as { ids: string[] };
  const numIds = ids.map(Number).filter((n) => !isNaN(n));
  if (numIds.length === 0) {
    return new Response("", { status: 400 });
  }
  await db.delete(transactionTypes).where(inArray(transactionTypes.id, numIds));
  return new Response("", { status: 200 });
};
