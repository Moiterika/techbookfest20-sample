import { GenericCommand } from "../../core/generic-command";
import { 取引更新Schema, type 取引更新入力 } from "../../../lib/validation";
import type { 取引更新Args } from "./取引更新Args";
import { 取引更新Validate } from "./取引更新Validate";
import { 取引更新Mapper } from "./取引更新Mapper";
import { db } from "../../../db";
import { transactions, items } from "../../../db/schema";
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
      .update(transactions)
      .set({
        date: args.date,
        transactionTypeId: args.transactionTypeId,
        itemId: args.itemId,
        unitPrice: args.unitPrice,
        quantity: args.quantity,
        amount: args.amount,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, args.id));

    const [row] = await db
      .select({
        id: transactions.id,
        date: transactions.date,
        transactionTypeId: transactions.transactionTypeId,
        itemId: transactions.itemId,
        unitPrice: transactions.unitPrice,
        quantity: transactions.quantity,
        amount: transactions.amount,
        createdAt: transactions.createdAt,
        updatedAt: transactions.updatedAt,
        itemCode: items.code,
        itemName: items.name,
      })
      .from(transactions)
      .leftJoin(items, eq(transactions.itemId, items.id))
      .where(eq(transactions.id, args.id));
    return row;
  },
});
