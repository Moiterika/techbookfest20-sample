import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import HeaderBodyLineRow from "../../../components/header-body/HeaderBodyLineRow.astro";
import { BOMヘッダーボディ } from "../../../features/BOM/gen-go.config";

const container = await AstroContainer.create();
const config = BOMヘッダーボディ;

/** GET /api/BOM/line-row?section=0|1 — 空の明細行HTMLを返す */
export const GET: APIRoute = async ({ url }) => {
  const sectionIdx = Number(url.searchParams.get("section")) || 0;
  const child = config.children[sectionIdx];
  if (!child) {
    return new Response("Invalid section", { status: 400 });
  }

  const rowKey = `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const disc = child.discriminator;

  const html = await container.renderToString(HeaderBodyLineRow, {
    props: {
      columns: child.columns,
      sectionIndex: sectionIdx,
      rowKey,
      discriminatorName: disc?.column,
      discriminatorValue: disc ? String(disc.value) : undefined,
    },
  });

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
};
