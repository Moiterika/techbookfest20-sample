import { GenericCommand } from "../../core/generic-command";
import { 品目更新Schema, type 品目更新入力 } from "../../../lib/validation";
import type { 品目UpdateArgs } from "./品目UpdateArgs";
import { 品目UpdateValidate } from "./品目UpdateValidate";
import { 品目UpdateMapper } from "./品目UpdateMapper";
import { db } from "../../../db";
import { 品目テーブル } from "../../../db/schema";
import { eq } from "drizzle-orm";
import type { 品目Response } from "../品目Response";

export const 品目UpdateCommand = new GenericCommand<
  品目更新入力,
  品目UpdateArgs,
  品目Response
>({
  schema: 品目更新Schema,
  validate: 品目UpdateValidate,
  mapper: 品目UpdateMapper,
  command: async (args) => {
    await db
      .update(品目テーブル)
      .set({
        コード: args.コード,
        名称: args.名称,
        カテゴリ: args.カテゴリ,
        単価: args.単価,
        バーコード: args.バーコード,
        更新日時: new Date(),
      })
      .where(eq(品目テーブル.id, args.id));

    const [row] = await db
      .select()
      .from(品目テーブル)
      .where(eq(品目テーブル.id, args.id));
    return row;
  },
});
