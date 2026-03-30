import { GenericCommand } from "../../core/generic-command";
import {
  取引区分更新Schema,
  type 取引区分更新入力,
} from "../../../lib/validation";
import type { 取引区分更新Args } from "./取引区分更新Args";
import { 取引区分更新Validate } from "./取引区分更新Validate";
import { 取引区分更新Mapper } from "./取引区分更新Mapper";
import { db } from "../../../db";
import { transactionTypes } from "../../../db/schema";
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
      .update(transactionTypes)
      .set({
        code: args.code,
        name: args.name,
        coefficient: args.coefficient,
        updatedAt: new Date(),
      })
      .where(eq(transactionTypes.id, args.id));

    const [row] = await db
      .select()
      .from(transactionTypes)
      .where(eq(transactionTypes.id, args.id));
    return row;
  },
});
