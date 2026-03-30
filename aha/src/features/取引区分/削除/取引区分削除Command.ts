import { GenericCommand } from "../../core/generic-command";
import { 単一削除Schema, type 単一削除入力 } from "../../../lib/validation";
import { db } from "../../../db";
import { transactionTypes } from "../../../db/schema";
import { eq } from "drizzle-orm";

export const 取引区分削除Command = new GenericCommand<
  単一削除入力,
  { id: number },
  void
>({
  schema: 単一削除Schema,
  mapper: (input) => ({ id: input.id }),
  command: async (args) => {
    await db.delete(transactionTypes).where(eq(transactionTypes.id, args.id));
  },
});
