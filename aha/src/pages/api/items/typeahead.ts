import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { db } from "../../../db";
import { items } from "../../../db/schema";
import { eq } from "drizzle-orm";
import ItemTypeaheadSearch from "../../../components/items/ItemTypeaheadSearch.astro";
import ItemTypeaheadBadge from "../../../components/items/ItemTypeaheadBadge.astro";

const container = await AstroContainer.create();

/** GET /api/items/typeahead?action=select|clear */
export const GET: APIRoute = async ({ url }) => {
  const action = url.searchParams.get("action") || "clear";
  const taName = url.searchParams.get("taName") || "itemId";
  const taFormId = url.searchParams.get("taFormId") || "";
  const taCompact = url.searchParams.get("taCompact") === "true";
  const taHideNameLabel = url.searchParams.get("taHideNameLabel") === "true";
  const taLookupId = url.searchParams.get("taLookupId") || "";

  if (action === "select") {
    const itemId = Number(url.searchParams.get("itemId"));
    if (!itemId) {
      return new Response("itemId is required", { status: 400 });
    }

    const [item] = await db
      .select({
        id: items.id,
        code: items.code,
        name: items.name,
        price: items.price,
      })
      .from(items)
      .where(eq(items.id, itemId))
      .limit(1);

    if (!item) {
      return new Response("item not found", { status: 404 });
    }

    let html = await container.renderToString(ItemTypeaheadBadge, {
      props: {
        name: taName,
        selectedId: item.id,
        selectedCode: item.code,
        selectedName: item.name,
        selectedPrice: item.price,
        formId: taFormId || undefined,
        hideNameLabel: taHideNameLabel,
      },
    });

    if (taLookupId) {
      html += `<span id="${taLookupId}" hx-swap-oob="true">${escapeHtml(item.name)}</span>`;
    }

    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  }

  // action === "clear"
  let html = await container.renderToString(ItemTypeaheadSearch, {
    props: {
      name: taName,
      formId: taFormId || undefined,
      compact: taCompact,
    },
  });

  if (taLookupId) {
    html += `<span id="${taLookupId}" hx-swap-oob="true"></span>`;
  }

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
