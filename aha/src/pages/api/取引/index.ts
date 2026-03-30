import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import {
  取引一覧Query,
  取引登録Command,
  取引一括削除Command,
  fetch取引区分オプション,
  get取引カラム,
  取引エンティティ,
} from "../../../features/取引";
// @ts-ignore
import CrudRows from "../../../components/crud/CrudRows.astro";
import { errorText } from "../../../styles/common";

const container = await AstroContainer.create();

/** GET /api/取引 — 取引一覧を HTML 断片で返す */
export const GET: APIRoute = async ({ url }) => {
  const result = await 取引一覧Query.execute({
    page: Number(url.searchParams.get("page")) || 1,
    size: Number(url.searchParams.get("size")) || 20,
    dateFrom: url.searchParams.get("dateFrom") || undefined,
    dateTo: url.searchParams.get("dateTo") || undefined,
  });

  const txTypeOptions = await fetch取引区分オプション();
  const 取引カラム = get取引カラム(txTypeOptions);

  const html = await container.renderToString(CrudRows, {
    props: {
      records: result.records,
      columns: 取引カラム,
      entity: 取引エンティティ,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      pageSize: result.pageSize,
      extraParams: result.extraParams,
    },
  });
  return new Response(html, { headers: { "Content-Type": "text/html" } });
};

/** POST /api/取引 — 取引を追加し、一覧（1ページ目）を返す */
export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();

  try {
    await 取引登録Command.execute({
      date: form.get("date") as string,
      transactionTypeId: Number(form.get("transactionTypeId")) || 0,
      itemId: Number(form.get("itemId")) || 0,
      unitPrice: Number(form.get("unitPrice")) || 0,
      quantity: Number(form.get("quantity")) || 1,
    });
  } catch (e: any) {
    return new Response(`<p class="${errorText}">${e.message}</p>`, {
      status: 422,
      headers: { "Content-Type": "text/html" },
    });
  }

  const url = new URL(request.url);
  const size = Number(url.searchParams.get("size")) || 20;
  const result = await 取引一覧Query.execute({ page: 1, size });
  const txTypeOptions = await fetch取引区分オプション();
  const 取引カラム = get取引カラム(txTypeOptions);

  const html = await container.renderToString(CrudRows, {
    props: {
      records: result.records,
      columns: 取引カラム,
      entity: 取引エンティティ,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      pageSize: result.pageSize,
      extraParams: result.extraParams,
    },
  });
  const resp = new Response(html, { headers: { "Content-Type": "text/html" } });
  resp.headers.set(
    "HX-Trigger",
    JSON.stringify({ "show-toast": encodeURIComponent("登録しました") }),
  );
  return resp;
};

/** DELETE /api/取引 — 選択された取引を一括削除 */
export const DELETE: APIRoute = async ({ request }) => {
  const { ids } = (await request.json()) as { ids: string[] };
  const numIds = ids.map(Number).filter((n) => !isNaN(n));
  if (numIds.length === 0) {
    return new Response("", { status: 400 });
  }
  await 取引一括削除Command.execute({ ids: numIds });
  return new Response("", { status: 200 });
};
