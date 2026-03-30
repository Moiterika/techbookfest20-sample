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
    type: Number(t),
    itemId: Number(itemIds[i]),
    quantity: (quantities[i] || "").trim(),
    unit: (units[i] || "").trim(),
    refBomCode: (refBomCodes[i] || "").trim() || null,
    refBomVersion: (refBomVersions[i] || "").trim() || null,
  }));
}

/** PUT /api/BOM/:id — BOM更新 */
export const PUT: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  if (!id) return new Response("", { status: 400 });

  const form = await request.formData();
  const code = ((form.get("code") as string) || "").trim();
  const version = ((form.get("version") as string) || "").trim();
  const name = ((form.get("name") as string) || "").trim();
  const lines = parseLines(form);

  try {
    await BOM更新Command.execute({ id, code, version, name, lines });
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

  await BOM削除Command.execute({ id });

  return new Response("", {
    status: 204,
    headers: { "HX-Redirect": "/BOM" },
  });
};
