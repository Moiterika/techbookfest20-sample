import { GenericCommand } from "../../core/generic-command";
import { BOM更新Schema, type BOM更新入力 } from "../../../lib/validation";
import type { BOM更新Args } from "./BOM更新Args";
import { BOM更新Validate } from "./BOM更新Validate";
import { BOM更新Mapper } from "./BOM更新Mapper";
import { db } from "../../../db";
import { boms, bomLines } from "../../../db/schema";
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
        .update(boms)
        .set({
          code: args.code,
          version: args.version,
          name: args.name,
          updatedAt: new Date(),
        })
        .where(eq(boms.id, args.id));

      await tx.delete(bomLines).where(eq(bomLines.bomId, args.id));

      if (args.lines.length > 0) {
        await tx.insert(bomLines).values(
          args.lines.map((l) => ({
            bomId: args.id,
            type: l.type,
            itemId: l.itemId,
            quantity: l.quantity,
            unit: l.unit,
            refBomCode: l.refBomCode,
            refBomVersion: l.refBomVersion,
          })),
        );
      }
    });
  },
});
