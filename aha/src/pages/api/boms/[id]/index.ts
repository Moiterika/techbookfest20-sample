import type { APIRoute } from "astro";
import { db } from "../../../../db";
import { boms, bomLines } from "../../../../db/schema";
import { eq } from "drizzle-orm";
import { errorText } from "../../../../styles/common.css";

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

/** PUT /api/boms/:id — BOM更新 */
export const PUT: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  if (!id) return new Response("", { status: 400 });

  const form = await request.formData();
  const code = ((form.get("code") as string) || "").trim();
  const version = ((form.get("version") as string) || "").trim();
  const name = ((form.get("name") as string) || "").trim();
  const lines = parseLines(form);

  if (!code || !version || !name) {
    const msg = !code
      ? "BOMコードは必須です"
      : !version
        ? "版は必須です"
        : "名称は必須です";
    return new Response(`<p class="${errorText}">${msg}</p>`, {
      status: 422,
      headers: { "Content-Type": "text/html" },
    });
  }

  if (!lines.some((l) => l.type === 2)) {
    return new Response(
      `<p class="${errorText}">製造行が少なくとも1行必要です</p>`,
      { status: 422, headers: { "Content-Type": "text/html" } },
    );
  }

  for (const line of lines) {
    if (!line.itemId || !line.quantity || !line.unit) {
      return new Response(
        `<p class="${errorText}">各行の品目・数量・単位は必須です</p>`,
        { status: 422, headers: { "Content-Type": "text/html" } },
      );
    }
    if (line.refBomVersion && !line.refBomCode) {
      return new Response(
        `<p class="${errorText}">BOM版を指定する場合、BOMコードも必要です</p>`,
        { status: 422, headers: { "Content-Type": "text/html" } },
      );
    }
  }

  const outputItemIds = new Set(
    lines.filter((l) => l.type === 2).map((l) => l.itemId),
  );
  const duplicateItem = lines.find(
    (l) => l.type === 1 && outputItemIds.has(l.itemId),
  );
  if (duplicateItem) {
    return new Response(
      `<p class="${errorText}">製造品目と投入品目に同じ品目は登録できません</p>`,
      { status: 422, headers: { "Content-Type": "text/html" } },
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(boms)
      .set({ code, version, name, updatedAt: new Date() })
      .where(eq(boms.id, id));

    await tx.delete(bomLines).where(eq(bomLines.bomId, id));

    if (lines.length > 0) {
      await tx.insert(bomLines).values(
        lines.map((l) => ({
          bomId: id,
          type: l.type,
          itemId: l.itemId,
          quantity: l.quantity,
          unit: l.unit,
          refBomCode: l.refBomCode,
          refBomVersion: l.refBomVersion,
        })),
      );
    }
  });

  return new Response("", {
    status: 204,
    headers: { "HX-Redirect": `/boms/${id}?saved=1` },
  });
};

/** DELETE /api/boms/:id — BOM削除 */
export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (!id) return new Response("", { status: 400 });

  await db.delete(boms).where(eq(boms.id, id));

  return new Response("", {
    status: 204,
    headers: { "HX-Redirect": "/boms" },
  });
};
