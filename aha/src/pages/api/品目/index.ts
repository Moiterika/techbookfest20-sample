import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import {
  品目一覧Query,
  品目登録Command,
  品目一括削除Command,
} from "../../../features/品目";
import { 品目カラム, 品目エンティティ } from "../../../features/品目";
// @ts-ignore
import CrudRows from "../../../components/crud/CrudRows.astro";
import { errorText } from "../../../styles/common";

const container = await AstroContainer.create();

/** GET /api/品目 — 品目一覧を HTML 断片で返す */
export const GET: APIRoute = async ({ url }) => {
  const result = await 品目一覧Query.execute({
    page: Number(url.searchParams.get("page")) || 1,
    size: Number(url.searchParams.get("size")) || 20,
    q: url.searchParams.get("q") || undefined,
    category: url.searchParams.get("category") || undefined,
  });

  const html = await container.renderToString(CrudRows, {
    props: {
      records: result.records,
      columns: 品目カラム,
      entity: 品目エンティティ,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      pageSize: result.pageSize,
      extraParams: result.extraParams,
    },
  });
  return new Response(html, { headers: { "Content-Type": "text/html" } });
};

/** POST /api/品目 — 品目を追加し、一覧（1ページ目）を返す */
export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();

  try {
    await 品目登録Command.execute({
      code: form.get("code") as string,
      name: form.get("name") as string,
      category: (form.get("category") as string) || undefined,
      price: Number(form.get("price")) || 0,
      barcode: (form.get("barcode") as string) || undefined,
    });
  } catch (e: any) {
    return new Response(`<p class="${errorText}">${e.message}</p>`, {
      status: 422,
      headers: { "Content-Type": "text/html" },
    });
  }

  const url = new URL(request.url);
  const size = Number(url.searchParams.get("size")) || 20;
  const result = await 品目一覧Query.execute({ page: 1, size });

  const html = await container.renderToString(CrudRows, {
    props: {
      records: result.records,
      columns: 品目カラム,
      entity: 品目エンティティ,
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

/** DELETE /api/品目 — 選択された品目を一括削除 */
export const DELETE: APIRoute = async ({ request }) => {
  const { ids } = (await request.json()) as { ids: string[] };
  const numIds = ids.map(Number).filter((n) => !isNaN(n));
  if (numIds.length === 0) {
    return new Response("", { status: 400 });
  }
  await 品目一括削除Command.execute({ ids: numIds });
  return new Response("", { status: 200 });
};
