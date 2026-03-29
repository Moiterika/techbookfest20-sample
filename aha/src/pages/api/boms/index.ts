import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { db } from "../../../db";
import { boms } from "../../../db/schema";
import { bomLines } from "../../../db/schema";
import { count, desc, ilike, inArray, or } from "drizzle-orm";
import BomListRows from "../../../components/boms/BomListRows.astro";
import { errorText } from "../../../styles/common.css";

const container = await AstroContainer.create();
const PAGE_SIZES = [20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;

async function renderBomPage(page: number, pageSize: number, query?: string) {
  const size = PAGE_SIZES.includes(pageSize as any)
    ? pageSize
    : DEFAULT_PAGE_SIZE;

  const searchFilter = query
    ? or(ilike(boms.code, `%${query}%`), ilike(boms.name, `%${query}%`))
    : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(boms)
    .where(searchFilter);
  const totalPages = Math.max(1, Math.ceil(total / size));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const rows = await db
    .select()
    .from(boms)
    .where(searchFilter)
    .orderBy(desc(boms.id))
    .limit(size)
    .offset((currentPage - 1) * size);

  const extraParams: Record<string, string> = {};
  if (query) extraParams.q = query;

  const html = await container.renderToString(BomListRows, {
    props: {
      records: rows,
      currentPage,
      totalPages,
      pageSize: size,
      extraParams,
    },
  });
  return new Response(html, { headers: { "Content-Type": "text/html" } });
}

/** GET /api/boms — BOM一覧をHTML断片で返す */
export const GET: APIRoute = async ({ url }) => {
  const page = Number(url.searchParams.get("page")) || 1;
  const size = Number(url.searchParams.get("size")) || DEFAULT_PAGE_SIZE;
  const query = url.searchParams.get("q") || "";
  return renderBomPage(page, size, query);
};

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

/** バリデーション — エラーがあれば Response を返す */
function validateBom(
  code: string,
  version: string,
  name: string,
  lines: ReturnType<typeof parseLines>,
): Response | null {
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

  return null;
}

/** POST /api/boms — BOM新規作成 */
export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const code = ((form.get("code") as string) || "").trim();
  const version = ((form.get("version") as string) || "").trim();
  const name = ((form.get("name") as string) || "").trim();
  const lines = parseLines(form);

  const err = validateBom(code, version, name, lines);
  if (err) return err;

  const [newBom] = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(boms)
      .values({ code, version, name })
      .returning({ id: boms.id });

    if (lines.length > 0) {
      await tx.insert(bomLines).values(
        lines.map((l) => ({
          bomId: inserted.id,
          type: l.type,
          itemId: l.itemId,
          quantity: l.quantity,
          unit: l.unit,
          refBomCode: l.refBomCode,
          refBomVersion: l.refBomVersion,
        })),
      );
    }

    return [inserted];
  });

  return new Response("", {
    status: 204,
    headers: { "HX-Redirect": `/boms/${newBom.id}?saved=1` },
  });
};

/** DELETE /api/boms — 選択されたBOMを一括削除 */
export const DELETE: APIRoute = async ({ request }) => {
  const { ids } = (await request.json()) as { ids: string[] };
  const numIds = ids.map(Number).filter((n) => !isNaN(n));
  if (numIds.length === 0) {
    return new Response("", { status: 400 });
  }
  await db.delete(boms).where(inArray(boms.id, numIds));
  return new Response("", { status: 200 });
};
