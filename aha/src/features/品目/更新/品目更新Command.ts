import { GenericCommand } from "../../core/generic-command";
import { 品目更新Schema, type 品目更新入力 } from "../../../lib/validation";
import type { 品目更新Args } from "./品目更新Args";
import { 品目更新Validate } from "./品目更新Validate";
import { 品目更新Mapper } from "./品目更新Mapper";
import { db } from "../../../db";
import { 品目テーブル } from "../../../db/schema";
import { eq } from "drizzle-orm";
import type { 品目Response } from "../品目Response";

export const 品目更新Command = new GenericCommand<
  品目更新入力,
  品目更新Args,
  品目Response
>({
  schema: 品目更新Schema,
  validate: 品目更新Validate,
  mapper: 品目更新Mapper,
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
      .where(eq(品目テーブル.ID, args.ID));

    const [row] = await db
      .select()
      .from(品目テーブル)
      .where(eq(品目テーブル.ID, args.ID));
    return row;
  },
});
