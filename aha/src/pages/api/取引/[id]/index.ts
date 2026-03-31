import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { 取引UpdateCommand } from "../../../../features/取引/update/取引UpdateCommand";
import { 取引DeleteCommand } from "../../../../features/取引/delete/取引DeleteCommand";
import {
  fetch取引区分オプション,
  get取引カラム,
  取引エンティティ,
} from "../../../../features/取引";
// @ts-ignore
import CrudRow from "../../../../components/crud/CrudRow.astro";
import { errorText } from "../../../../styles/common";

const container = await AstroContainer.create();

/** PUT /api/取引/:id — 取引を更新し、行 HTML を返す */
export const PUT: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  const form = await request.formData();

  let row;
  try {
    row = await 取引UpdateCommand.execute({
      id,
      日付: form.get("日付") as string,
      取引区分ID: Number(form.get("取引区分ID")) || 0,
      品目ID: Number(form.get("品目ID")) || 0,
      単価: Number(form.get("単価")) || 0,
      数量: Number(form.get("数量")) || 1,
    });
  } catch (e: any) {
    return new Response(`<p class="${errorText}">${e.message}</p>`, {
      status: 422,
      headers: { "Content-Type": "text/html" },
    });
  }

  const txTypeOptions = await fetch取引区分オプション();
  const 取引カラム = get取引カラム(txTypeOptions);

  const html = await container.renderToString(CrudRow, {
    props: { record: row, columns: 取引カラム, entity: 取引エンティティ },
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

/** DELETE /api/取引/:id — 取引を削除 */
export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  await 取引DeleteCommand.execute({ id });
  return new Response("", { headers: { "Content-Type": "text/html" } });
};
