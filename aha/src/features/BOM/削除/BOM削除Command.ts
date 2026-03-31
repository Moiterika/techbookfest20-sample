import { GenericCommand } from "../../core/generic-command";
import { 単一削除Schema, type 単一削除入力 } from "../../../lib/validation";
import { db } from "../../../db";
import { BOMテーブル } from "../../../db/schema";
import { eq } from "drizzle-orm";

export const BOM削除Command = new GenericCommand<
  単一削除入力,
  { id: number },
  void
>({
  schema: 単一削除Schema,
  mapper: (input) => ({ id: input.ID }),
  command: async (args) => {
    await db.delete(BOMテーブル).where(eq(BOMテーブル.ID, args.id));
  },
});
