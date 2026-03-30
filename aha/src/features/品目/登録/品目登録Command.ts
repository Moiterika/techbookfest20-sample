import { GenericCommand } from "../../core/generic-command";
import { 品目作成Schema, type 品目作成入力 } from "../../../lib/validation";
import type { 品目登録Args } from "./品目登録Args";
import { 品目登録Validate } from "./品目登録Validate";
import { 品目作成Mapper } from "./品目作成Mapper";
import { db } from "../../../db";
import { items } from "../../../db/schema";

export const 品目登録Command = new GenericCommand<
  品目作成入力,
  品目登録Args,
  void
>({
  schema: 品目作成Schema,
  validate: 品目登録Validate,
  mapper: 品目作成Mapper,
  command: async (args) => {
    await db.insert(items).values(args);
  },
});
