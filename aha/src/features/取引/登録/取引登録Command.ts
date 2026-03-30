import { GenericCommand } from "../../core/generic-command";
import { 取引作成Schema, type 取引作成入力 } from "../../../lib/validation";
import type { 取引登録Args } from "./取引登録Args";
import { 取引登録Validate } from "./取引登録Validate";
import { 取引作成Mapper } from "./取引作成Mapper";
import { db } from "../../../db";
import { transactions } from "../../../db/schema";

export const 取引登録Command = new GenericCommand<
  取引作成入力,
  取引登録Args,
  void
>({
  schema: 取引作成Schema,
  validate: 取引登録Validate,
  mapper: 取引作成Mapper,
  command: async (args) => {
    await db.insert(transactions).values(args);
  },
});
