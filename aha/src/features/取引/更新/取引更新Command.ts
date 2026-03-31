import { GenericCommand } from "../../core/generic-command";
import { 取引更新Schema, type 取引更新入力 } from "../../../lib/validation";
import type { 取引更新Args } from "./取引更新Args";
import { 取引更新Validate } from "./取引更新Validate";
import { 取引更新Mapper } from "./取引更新Mapper";
import { db } from "../../../db";
import { 取引テーブル, 品目テーブル } from "../../../db/schema";
import { eq } from "drizzle-orm";
import type { 取引Response } from "../取引Response";

export const 取引更新Command = new GenericCommand<
  取引更新入力,
  取引更新Args,
  取引Response
>({
  schema: 取引更新Schema,
  validate: 取引更新Validate,
  mapper: 取引更新Mapper,
  command: async (args) => {
    await db
      .update(取引テーブル)
      .set({
        日付: args.日付,
        取引区分ID: args.取引区分ID,
        品目ID: args.品目ID,
        単価: args.単価,
        数量: args.数量,
        金額: args.金額,
        更新日時: new Date(),
      })
      .where(eq(取引テーブル.ID, args.ID));

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
      .where(eq(取引テーブル.ID, args.ID));
    return row;
  },
});
