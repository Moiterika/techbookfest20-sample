import { GenericCommand } from "../../core/generic-command";
import { BOM作成Schema, type BOM作成入力 } from "../../../lib/validation";
import type { BOM登録Args } from "./BOM登録Args";
import { BOM登録Validate } from "./BOM登録Validate";
import { BOM作成Mapper } from "./BOM作成Mapper";
import { db } from "../../../db";
import { BOMテーブル, BOM明細テーブル } from "../../../db/schema";

export const BOM登録Command = new GenericCommand<
  BOM作成入力,
  BOM登録Args,
  { id: number }
>({
  schema: BOM作成Schema,
  validate: BOM登録Validate,
  mapper: BOM作成Mapper,
  command: async (args) => {
    const [newBom] = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(BOMテーブル)
        .values({
          コード: args.コード,
          版: args.版,
          名称: args.名称,
        })
        .returning({ id: BOMテーブル.ID });

      if (args.明細.length > 0) {
        await tx.insert(BOM明細テーブル).values(
          args.明細.map((l) => ({
            BOM_ID: inserted.id,
            区分: l.区分,
            品目ID: l.品目ID,
            数量: l.数量,
            単位: l.単位,
            参照BOMコード: l.参照BOMコード,
            参照BOM版: l.参照BOM版,
          })),
        );
      }

      return [inserted];
    });
    return newBom;
  },
});
