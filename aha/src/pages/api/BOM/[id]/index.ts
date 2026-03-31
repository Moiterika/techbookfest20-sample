import type { APIRoute } from "astro";
import { BOM更新Command } from "../../../../features/BOM/更新/BOM更新Command";
import { BOM削除Command } from "../../../../features/BOM/削除/BOM削除Command";
import { errorText } from "../../../../styles/common";

/** FormData から明細行を組み立てる */
function parseLines(form: FormData) {
  const types = form.getAll("lineType") as string[];
  const itemIds = form.getAll("lineItemId") as string[];
  const quantities = form.getAll("lineQuantity") as string[];
  const units = form.getAll("lineUnit") as string[];
  const refBomCodes = form.getAll("lineRefBomCode") as string[];
  const refBomVersions = form.getAll("lineRefBomVersion") as string[];

  return types.map((t, i) => ({
    区分: Number(t),
    品目ID: Number(itemIds[i]),
    数量: (quantities[i] || "").trim(),
    単位: (units[i] || "").trim(),
    参照BOMコード: (refBomCodes[i] || "").trim() || null,
    参照BOM版: (refBomVersions[i] || "").trim() || null,
  }));
}

/** PUT /api/BOM/:id — BOM更新 */
export const PUT: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  if (!id) return new Response("", { status: 400 });

  const form = await request.formData();
  const コード = ((form.get("code") as string) || "").trim();
  const 版 = ((form.get("version") as string) || "").trim();
  const 名称 = ((form.get("name") as string) || "").trim();
  const 明細 = parseLines(form);

  try {
    await BOM更新Command.execute({ ID: id, コード, 版, 名称, 明細 });
  } catch (e: any) {
    return new Response(`<p class="${errorText}">${e.message}</p>`, {
      status: 422,
      headers: { "Content-Type": "text/html" },
    });
  }

  return new Response("", {
    status: 204,
    headers: { "HX-Redirect": `/BOM/${id}?saved=1` },
  });
};

/** DELETE /api/BOM/:id — BOM削除 */
export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (!id) return new Response("", { status: 400 });

  await BOM削除Command.execute({ ID: id });

  return new Response("", {
    status: 204,
    headers: { "HX-Redirect": "/BOM" },
  });
};
