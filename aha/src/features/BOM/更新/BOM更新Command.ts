import { GenericCommand } from "../../core/generic-command";
import { BOM更新Schema, type BOM更新入力 } from "../../../lib/validation";
import type { BOM更新Args } from "./BOM更新Args";
import { BOM更新Validate } from "./BOM更新Validate";
import { BOM更新Mapper } from "./BOM更新Mapper";
import { db } from "../../../db";
import { BOMテーブル, BOM明細テーブル } from "../../../db/schema";
import { eq } from "drizzle-orm";

export const BOM更新Command = new GenericCommand<
  BOM更新入力,
  BOM更新Args,
  void
>({
  schema: BOM更新Schema,
  validate: BOM更新Validate,
  mapper: BOM更新Mapper,
  command: async (args) => {
    await db.transaction(async (tx) => {
      await tx
        .update(BOMテーブル)
        .set({
          コード: args.コード,
          版: args.版,
          名称: args.名称,
          更新日時: new Date(),
        })
        .where(eq(BOMテーブル.ID, args.ID));

      await tx
        .delete(BOM明細テーブル)
        .where(eq(BOM明細テーブル.BOM_ID, args.ID));

      if (args.明細.length > 0) {
        await tx.insert(BOM明細テーブル).values(
          args.明細.map((l) => ({
            BOM_ID: args.ID,
            区分: l.区分,
            品目ID: l.品目ID,
            数量: l.数量,
            単位: l.単位,
            参照BOMコード: l.参照BOMコード,
            参照BOM版: l.参照BOM版,
          })),
        );
      }
    });
  },
});
