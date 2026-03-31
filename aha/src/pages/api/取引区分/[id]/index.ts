import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { 取引区分UpdateCommand } from "../../../../features/取引区分/update/取引区分UpdateCommand";
import { 取引区分DeleteCommand } from "../../../../features/取引区分/delete/取引区分DeleteCommand";
import {
  取引区分カラム,
  取引区分エンティティ,
} from "../../../../features/取引区分";
// @ts-ignore
import CrudRow from "../../../../components/crud/CrudRow.astro";
import { errorText } from "../../../../styles/common";

const container = await AstroContainer.create();

/** PUT /api/取引区分/:id — 取引区分を更新し、行 HTML を返す */
export const PUT: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  const form = await request.formData();

  let row;
  try {
    row = await 取引区分UpdateCommand.execute({
      id,
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

  const html = await container.renderToString(CrudRow, {
    props: {
      record: row,
      columns: 取引区分カラム,
      entity: 取引区分エンティティ,
    },
  });
  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
      "HX-Trigger": JSON.stringify({
        "show-toast": encodeURIComponent("更新しました"),
      }),
    },
  });
};

/** DELETE /api/取引区分/:id — 取引区分を削除 */
export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  await 取引区分DeleteCommand.execute({ id });
  return new Response("", { headers: { "Content-Type": "text/html" } });
};
