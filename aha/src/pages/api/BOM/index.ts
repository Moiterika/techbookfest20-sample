import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { BOM一覧Query } from "../../../features/BOM/一覧/BOM一覧Query";
import { BOM登録Command } from "../../../features/BOM/登録/BOM登録Command";
import { BOM一括削除Command } from "../../../features/BOM/削除/BOM一括削除Command";
import BomListRows from "../../../components/BOM/BomListRows.astro";
import { errorText } from "../../../styles/common";

const container = await AstroContainer.create();

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

/** GET /api/BOM — BOM一覧をHTML断片で返す */
export const GET: APIRoute = async ({ url }) => {
  const result = await BOM一覧Query.execute({
    page: Number(url.searchParams.get("page")) || 1,
    size: Number(url.searchParams.get("size")) || 20,
    q: url.searchParams.get("q") || undefined,
  });

  const html = await container.renderToString(BomListRows, {
    props: {
      records: result.records,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      pageSize: result.pageSize,
      extraParams: result.extraParams,
    },
  });
  return new Response(html, { headers: { "Content-Type": "text/html" } });
};

/** POST /api/BOM — BOM新規作成 */
export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const code = ((form.get("code") as string) || "").trim();
  const version = ((form.get("version") as string) || "").trim();
  const name = ((form.get("name") as string) || "").trim();
  const lines = parseLines(form);

  let newBom;
  try {
    newBom = await BOM登録Command.execute({
      code,
      version,
      name,
      lines,
    });
  } catch (e: any) {
    return new Response(`<p class="${errorText}">${e.message}</p>`, {
      status: 422,
      headers: { "Content-Type": "text/html" },
    });
  }

  return new Response("", {
    status: 204,
    headers: { "HX-Redirect": `/BOM/${newBom.id}?saved=1` },
  });
};

/** DELETE /api/BOM — 選択されたBOMを一括削除 */
export const DELETE: APIRoute = async ({ request }) => {
  const { ids } = (await request.json()) as { ids: string[] };
  const numIds = ids.map(Number).filter((n) => !isNaN(n));
  if (numIds.length === 0) {
    return new Response("", { status: 400 });
  }
  await BOM一括削除Command.execute({ ids: numIds });
  return new Response("", { status: 200 });
};
