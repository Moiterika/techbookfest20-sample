import { GenericCommand } from "../../core/generic-command";
import { BOM更新Schema, type BOM更新入力 } from "../../../lib/validation";
import type { BOMUpdateArgs } from "./BOMUpdateArgs";
import { BOMUpdateValidate } from "./BOMUpdateValidate";
import { BOMUpdateMapper } from "./BOMUpdateMapper";
import { db } from "../../../db";
import { BOMテーブル, BOM明細テーブル } from "../../../db/schema";
import { eq } from "drizzle-orm";

export const BOMUpdateCommand = new GenericCommand<
  BOM更新入力,
  BOMUpdateArgs,
  void
>({
  schema: BOM更新Schema,
  validate: BOMUpdateValidate,
  mapper: BOMUpdateMapper,
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
        .where(eq(BOMテーブル.id, args.id));

      await tx
        .delete(BOM明細テーブル)
        .where(eq(BOM明細テーブル.BOM_ID, args.id));

      if (args.明細.length > 0) {
        await tx.insert(BOM明細テーブル).values(
          args.明細.map((l) => ({
            BOM_ID: args.id,
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
