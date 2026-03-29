import type { APIRoute } from "astro";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { db } from "../../../../db";
import { transactionTypes } from "../../../../db/schema";
import { eq } from "drizzle-orm";
import CrudRow from "../../../../components/crud/CrudRow.astro";
import {
  txTypeColumns,
  txTypeEntity,
} from "../../../../features/transaction-types";
import { errorText } from "../../../../styles/common.css";

const container = await AstroContainer.create();

/** PUT /api/transaction-types/:id — 取引区分を更新し、行 HTML を返す */
export const PUT: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  const form = await request.formData();
  const code = form.get("code") as string;
  const name = form.get("name") as string;
  const coefficient = Number(form.get("coefficient")) || 0;

  if (!code || !name) {
    const msg = !code ? "取引区分コードは必須です" : "取引区分名称は必須です";
    return new Response(`<p class="${errorText}">${msg}</p>`, {
      status: 422,
      headers: { "Content-Type": "text/html" },
    });
  }

  if (![-1, 0, 1].includes(coefficient)) {
    return new Response(
      `<p class="${errorText}">受払係数は -1, 0, 1 のいずれかです</p>`,
      { status: 422, headers: { "Content-Type": "text/html" } },
    );
  }

  await db
    .update(transactionTypes)
    .set({ code, name, coefficient, updatedAt: new Date() })
    .where(eq(transactionTypes.id, id));

  const [row] = await db
    .select()
    .from(transactionTypes)
    .where(eq(transactionTypes.id, id));

  const html = await container.renderToString(CrudRow, {
    props: { record: row, columns: txTypeColumns, entity: txTypeEntity },
  });
  return new Response(html, { headers: { "Content-Type": "text/html" } });
};

/** DELETE /api/transaction-types/:id — 取引区分を削除（空レスポンスで行が消える） */
export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  await db.delete(transactionTypes).where(eq(transactionTypes.id, id));
  return new Response("", { headers: { "Content-Type": "text/html" } });
};
