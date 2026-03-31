import { GenericCommand } from "../../core/generic-command";
import { 取引作成Schema, type 取引作成入力 } from "../../../lib/validation";
import type { 取引CreateArgs } from "./取引CreateArgs";
import { 取引CreateValidate } from "./取引CreateValidate";
import { 取引CreateMapper } from "./取引CreateMapper";
import { db } from "../../../db";
import { 取引テーブル } from "../../../db/schema";

export const 取引CreateCommand = new GenericCommand<
  取引作成入力,
  取引CreateArgs,
  void
>({
  schema: 取引作成Schema,
  validate: 取引CreateValidate,
  mapper: 取引CreateMapper,
  command: async (args) => {
    await db.insert(取引テーブル).values(args);
  },
});
