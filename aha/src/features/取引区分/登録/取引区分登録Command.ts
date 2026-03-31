import { GenericCommand } from "../../core/generic-command";
import {
  取引区分作成Schema,
  type 取引区分作成入力,
} from "../../../lib/validation";
import type { 取引区分登録Args } from "./取引区分登録Args";
import { 取引区分登録Validate } from "./取引区分登録Validate";
import { 取引区分作成Mapper } from "./取引区分作成Mapper";
import { db } from "../../../db";
import { 取引区分テーブル } from "../../../db/schema";

export const 取引区分登録Command = new GenericCommand<
  取引区分作成入力,
  取引区分登録Args,
  void
>({
  schema: 取引区分作成Schema,
  validate: 取引区分登録Validate,
  mapper: 取引区分作成Mapper,
  command: async (args) => {
    await db.insert(取引区分テーブル).values(args);
  },
});
