import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { BOM一覧Query } from "../../../features/BOM/query/BOM一覧Query";
import { BOMCreateCommand } from "../../../features/BOM/create/BOMCreateCommand";
import { BOMBulkDeleteCommand } from "../../../features/BOM/delete/BOMBulkDeleteCommand";
import HeaderBodyListRows from "../../../components/header-body/HeaderBodyListRows.astro";
import { BOMヘッダーボディ } from "../../../features/BOM/gen-go.config";
import { errorText } from "../../../styles/common";

const container = await AstroContainer.create();
const config = BOMヘッダーボディ;

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

/** GET /api/BOM — BOM一覧をHTML断片で返す */
export const GET: APIRoute = async ({ url }) => {
  const result = await BOM一覧Query.execute({
    page: Number(url.searchParams.get("page")) || 1,
    size: Number(url.searchParams.get("size")) || 20,
    q: url.searchParams.get("q") || undefined,
  });

  const html = await container.renderToString(HeaderBodyListRows, {
    props: {
      config,
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
  const コード = ((form.get("コード") as string) || "").trim();
  const 版 = ((form.get("版") as string) || "").trim();
  const 名称 = ((form.get("名称") as string) || "").trim();
  const 明細 = parseLines(form);

  let newBom;
  try {
    newBom = await BOMCreateCommand.execute({
      コード,
      版,
      名称,
      明細,
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
  await BOMBulkDeleteCommand.execute({ ids: numIds });
  return new Response("", { status: 200 });
};
