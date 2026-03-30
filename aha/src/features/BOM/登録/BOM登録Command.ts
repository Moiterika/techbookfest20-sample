import { GenericCommand } from "../../core/generic-command";
import { BOM作成Schema, type BOM作成入力 } from "../../../lib/validation";
import type { BOM登録Args } from "./BOM登録Args";
import { BOM登録Validate } from "./BOM登録Validate";
import { BOM作成Mapper } from "./BOM作成Mapper";
import { db } from "../../../db";
import { boms, bomLines } from "../../../db/schema";

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
        .insert(boms)
        .values({ code: args.code, version: args.version, name: args.name })
        .returning({ id: boms.id });

      if (args.lines.length > 0) {
        await tx.insert(bomLines).values(
          args.lines.map((l) => ({
            bomId: inserted.id,
            type: l.type,
            itemId: l.itemId,
            quantity: l.quantity,
            unit: l.unit,
            refBomCode: l.refBomCode,
            refBomVersion: l.refBomVersion,
          })),
        );
      }

      return [inserted];
    });
    return newBom;
  },
});
