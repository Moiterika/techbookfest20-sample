import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import {
  取引区分一覧Query,
  取引区分登録Command,
  取引区分一括削除Command,
} from "../../../features/取引区分";
import {
  取引区分カラム,
  取引区分エンティティ,
} from "../../../features/取引区分";
// @ts-ignore
import CrudRows from "../../../components/crud/CrudRows.astro";
import { errorText } from "../../../styles/common";

const container = await AstroContainer.create();

/** GET /api/取引区分 — 取引区分一覧を HTML 断片で返す */
export const GET: APIRoute = async ({ url }) => {
  const result = await 取引区分一覧Query.execute({
    page: Number(url.searchParams.get("page")) || 1,
    size: Number(url.searchParams.get("size")) || 20,
  });

  const html = await container.renderToString(CrudRows, {
    props: {
      records: result.records,
      columns: 取引区分カラム,
      entity: 取引区分エンティティ,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      pageSize: result.pageSize,
      extraParams: {},
    },
  });
  return new Response(html, { headers: { "Content-Type": "text/html" } });
};

/** POST /api/取引区分 — 取引区分を追加し、一覧（1ページ目）を返す */
export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();

  try {
    await 取引区分登録Command.execute({
      コード: form.get("コード") as string,
      名称: form.get("名称") as string,
      係数: Number(form.get("係数")) || 0,
    });
  } catch (e: any) {
    return new Response(`<p class="${errorText}">${e.message}</p>`, {
      status: 422,
      headers: { "Content-Type": "text/html" },
    });
  }

  const url = new URL(request.url);
  const size = Number(url.searchParams.get("size")) || 20;
  const result = await 取引区分一覧Query.execute({ page: 1, size });

  const html = await container.renderToString(CrudRows, {
    props: {
      records: result.records,
      columns: 取引区分カラム,
      entity: 取引区分エンティティ,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      pageSize: result.pageSize,
      extraParams: {},
    },
  });
  const resp = new Response(html, { headers: { "Content-Type": "text/html" } });
  resp.headers.set(
    "HX-Trigger",
    JSON.stringify({ "show-toast": encodeURIComponent("登録しました") }),
  );
  return resp;
};

/** DELETE /api/取引区分 — 選択された取引区分を一括削除 */
export const DELETE: APIRoute = async ({ request }) => {
  const { ids } = (await request.json()) as { ids: string[] };
  const numIds = ids.map(Number).filter((n) => !isNaN(n));
  if (numIds.length === 0) {
    return new Response("", { status: 400 });
  }
  await 取引区分一括削除Command.execute({ ids: numIds });
  return new Response("", { status: 200 });
};
