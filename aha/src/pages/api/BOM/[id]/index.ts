import type { APIRoute } from "astro";
import { BOMUpdateCommand } from "../../../../features/BOM/update/BOMUpdateCommand";
import { BOMDeleteCommand } from "../../../../features/BOM/delete/BOMDeleteCommand";
import { errorText } from "../../../../styles/common";

/** FormData から明細行を組み立てる */
function parseLines(form: FormData) {
  const types = form.getAll("line区分") as string[];
  const itemIds = form.getAll("line品目ID") as string[];
  const quantities = form.getAll("line数量") as string[];
  const units = form.getAll("line単位") as string[];
  const refBomCodes = form.getAll("line参照BOMコード") as string[];
  const refBomVersions = form.getAll("line参照BOM版") as string[];

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
  const コード = ((form.get("コード") as string) || "").trim();
  const 版 = ((form.get("版") as string) || "").trim();
  const 名称 = ((form.get("名称") as string) || "").trim();
  const 明細 = parseLines(form);

  try {
    await BOMUpdateCommand.execute({ id, コード, 版, 名称, 明細 });
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

  await BOMDeleteCommand.execute({ id });

  return new Response("", {
    status: 204,
    headers: { "HX-Redirect": "/BOM" },
  });
};
