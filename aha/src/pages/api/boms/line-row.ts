import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import BomLineRow from "../../../components/boms/BomLineRow.astro";

const container = await AstroContainer.create();

/** GET /api/boms/line-row?section=output|input — 空の明細行HTMLを返す */
export const GET: APIRoute = async ({ url }) => {
  const section =
    url.searchParams.get("section") === "input" ? "input" : "output";
  const rowKey = `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const html = await container.renderToString(BomLineRow, {
    props: { section, rowKey },
  });

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
};
