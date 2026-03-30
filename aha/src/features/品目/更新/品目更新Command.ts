import { GenericCommand } from "../../core/generic-command";
import { 品目更新Schema, type 品目更新入力 } from "../../../lib/validation";
import type { 品目更新Args } from "./品目更新Args";
import { 品目更新Validate } from "./品目更新Validate";
import { 品目更新Mapper } from "./品目更新Mapper";
import { db } from "../../../db";
import { items } from "../../../db/schema";
import { eq } from "drizzle-orm";
import type { 品目Response } from "../品目Response";

export const 品目更新Command = new GenericCommand<
  品目更新入力,
  品目更新Args,
  品目Response
>({
  schema: 品目更新Schema,
  validate: 品目更新Validate,
  mapper: 品目更新Mapper,
  command: async (args) => {
    await db
      .update(items)
      .set({
        code: args.code,
        name: args.name,
        category: args.category,
        price: args.price,
        barcode: args.barcode,
        updatedAt: new Date(),
      })
      .where(eq(items.id, args.id));

    const [row] = await db.select().from(items).where(eq(items.id, args.id));
    return row;
  },
});
