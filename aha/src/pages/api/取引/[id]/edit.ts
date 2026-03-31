import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { db } from "../../../../db";
import { 取引テーブル, 品目テーブル } from "../../../../db/schema";
import { eq } from "drizzle-orm";
import {
  fetch取引区分オプション,
  get取引カラム,
  取引エンティティ,
} from "../../../../features/取引";
// @ts-ignore
import CrudEditRow from "../../../../components/crud/CrudEditRow.astro";

const container = await AstroContainer.create();

/** GET /api/取引/:id/edit — インライン編集行を返す */
export const GET: APIRoute = async ({ params }) => {
  const id = Number(params.id);

  const [row] = await db
    .select({
      ID: 取引テーブル.ID,
      日付: 取引テーブル.日付,
      取引区分ID: 取引テーブル.取引区分ID,
      品目ID: 取引テーブル.品目ID,
      単価: 取引テーブル.単価,
      数量: 取引テーブル.数量,
      金額: 取引テーブル.金額,
      作成日時: 取引テーブル.作成日時,
      更新日時: 取引テーブル.更新日時,
      品目コード: 品目テーブル.コード,
      品目名: 品目テーブル.名称,
    })
    .from(取引テーブル)
    .leftJoin(品目テーブル, eq(取引テーブル.品目ID, 品目テーブル.ID))
    .where(eq(取引テーブル.ID, id));

  if (!row) {
    return new Response("Not found", { status: 404 });
  }

  const txTypeOptions = await fetch取引区分オプション();
  const 取引カラム = get取引カラム(txTypeOptions);

  const html = await container.renderToString(CrudEditRow, {
    props: { record: row, columns: 取引カラム, entity: 取引エンティティ },
  });
  return new Response(html, { headers: { "Content-Type": "text/html" } });
};
