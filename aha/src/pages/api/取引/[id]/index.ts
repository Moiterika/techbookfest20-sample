import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { 取引更新Command } from "../../../../features/取引/更新/取引更新Command";
import { 取引削除Command } from "../../../../features/取引/削除/取引削除Command";
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
    row = await 取引更新Command.execute({
      id,
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
  await 取引削除Command.execute({ id });
  return new Response("", { headers: { "Content-Type": "text/html" } });
};
