/**
 * gen-go.ts 用: AstroContainer で CRUD コンポーネントをダミーデータでレンダリングし、
 * Tailwind クラス付き HTML を返す。ビルド時にのみ使用。
 */
import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
// @ts-ignore
import CrudRow from "../../components/crud/CrudRow.astro";

import { 品目カラム, 品目エンティティ } from "../../features/品目";

const container = await AstroContainer.create();

const dummyRecord: Record<string, any> = {
  id: 99999,
  code: "__PH_CODE__",
  name: "__PH_NAME__",
  category: "__PH_CATEGORY__",
  price: 12345678,
  barcode: "__PH_BARCODE__",
};

export const GET: APIRoute = async () => {
  const rowHtml = await container.renderToString(CrudRow, {
    props: {
      record: dummyRecord,
      columns: 品目カラム,
      entity: 品目エンティティ,
    },
  });

  return new Response(JSON.stringify({ row: rowHtml }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
};
