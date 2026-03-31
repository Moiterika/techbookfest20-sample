import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { 品目UpdateCommand } from "../../../../features/品目/update/品目UpdateCommand";
import { 品目DeleteCommand } from "../../../../features/品目/delete/品目DeleteCommand";
import { 品目カラム, 品目エンティティ } from "../../../../features/品目";
// @ts-ignore
import CrudRow from "../../../../components/crud/CrudRow.astro";
import { errorText } from "../../../../styles/common";

const container = await AstroContainer.create();

/** PUT /api/品目/:id — 品目を更新し、行 HTML を返す */
export const PUT: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  const form = await request.formData();

  let row;
  try {
    row = await 品目UpdateCommand.execute({
      id,
      コード: form.get("コード") as string,
      名称: form.get("名称") as string,
      カテゴリ: (form.get("カテゴリ") as string) || undefined,
      単価: Number(form.get("単価")) || 0,
      バーコード: (form.get("バーコード") as string) || undefined,
    });
  } catch (e: any) {
    return new Response(`<p class="${errorText}">${e.message}</p>`, {
      status: 422,
      headers: { "Content-Type": "text/html" },
    });
  }

  const html = await container.renderToString(CrudRow, {
    props: { record: row, columns: 品目カラム, entity: 品目エンティティ },
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

/** DELETE /api/品目/:id — 品目を削除 */
export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  await 品目DeleteCommand.execute({ id });
  return new Response("", { headers: { "Content-Type": "text/html" } });
};
