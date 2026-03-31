import { GenericCommand } from "../../core/generic-command";
import { 一括削除Schema, type 一括削除入力 } from "../../../lib/validation";
import { db } from "../../../db";
import { 品目テーブル } from "../../../db/schema";
import { inArray } from "drizzle-orm";

export const 品目一括削除Command = new GenericCommand<
  一括削除入力,
  { ids: number[] },
  void
>({
  schema: 一括削除Schema,
  mapper: (input) => ({ ids: input.ids }),
  command: async (args) => {
    if (args.ids.length > 0) {
      await db.delete(品目テーブル).where(inArray(品目テーブル.ID, args.ids));
    }
  },
});
