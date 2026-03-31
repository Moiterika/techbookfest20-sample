import { GenericCommand } from "../../core/generic-command";
import {
  取引区分更新Schema,
  type 取引区分更新入力,
} from "../../../lib/validation";
import type { 取引区分更新Args } from "./取引区分更新Args";
import { 取引区分更新Validate } from "./取引区分更新Validate";
import { 取引区分更新Mapper } from "./取引区分更新Mapper";
import { db } from "../../../db";
import { 取引区分テーブル } from "../../../db/schema";
import { eq } from "drizzle-orm";
import type { 取引区分Response } from "../取引区分Response";

export const 取引区分更新Command = new GenericCommand<
  取引区分更新入力,
  取引区分更新Args,
  取引区分Response
>({
  schema: 取引区分更新Schema,
  validate: 取引区分更新Validate,
  mapper: 取引区分更新Mapper,
  command: async (args) => {
    await db
      .update(取引区分テーブル)
      .set({
        コード: args.コード,
        名称: args.名称,
        係数: args.係数,
        更新日時: new Date(),
      })
      .where(eq(取引区分テーブル.ID, args.ID));

    const [row] = await db
      .select()
      .from(取引区分テーブル)
      .where(eq(取引区分テーブル.ID, args.ID));
    return row;
  },
});
