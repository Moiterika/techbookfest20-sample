import { GenericCommand } from "../../core/generic-command";
import {
  取引区分更新Schema,
  type 取引区分更新入力,
} from "../../../lib/validation";
import type { 取引区分UpdateArgs } from "./取引区分UpdateArgs";
import { 取引区分UpdateValidate } from "./取引区分UpdateValidate";
import { 取引区分UpdateMapper } from "./取引区分UpdateMapper";
import { db } from "../../../db";
import { 取引区分テーブル } from "../../../db/schema";
import { eq } from "drizzle-orm";
import type { 取引区分Response } from "../取引区分Response";

export const 取引区分UpdateCommand = new GenericCommand<
  取引区分更新入力,
  取引区分UpdateArgs,
  取引区分Response
>({
  schema: 取引区分更新Schema,
  validate: 取引区分UpdateValidate,
  mapper: 取引区分UpdateMapper,
  command: async (args) => {
    await db
      .update(取引区分テーブル)
      .set({
        コード: args.コード,
        名称: args.名称,
        係数: args.係数,
        更新日時: new Date(),
      })
      .where(eq(取引区分テーブル.id, args.id));

    const [row] = await db
      .select()
      .from(取引区分テーブル)
      .where(eq(取引区分テーブル.id, args.id));
    return row;
  },
});
