import { GenericCommand } from "../../core/generic-command";
import {
  取引区分作成Schema,
  type 取引区分作成入力,
} from "../../../lib/validation";
import type { 取引区分CreateArgs } from "./取引区分CreateArgs";
import { 取引区分CreateValidate } from "./取引区分CreateValidate";
import { 取引区分CreateMapper } from "./取引区分CreateMapper";
import { db } from "../../../db";
import { 取引区分テーブル } from "../../../db/schema";

export const 取引区分CreateCommand = new GenericCommand<
  取引区分作成入力,
  取引区分CreateArgs,
  void
>({
  schema: 取引区分作成Schema,
  validate: 取引区分CreateValidate,
  mapper: 取引区分CreateMapper,
  command: async (args) => {
    await db.insert(取引区分テーブル).values(args);
  },
});
