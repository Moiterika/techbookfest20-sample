import { GenericCommand } from "../../core/generic-command";
import { 品目作成Schema, type 品目作成入力 } from "../../../lib/validation";
import type { 品目CreateArgs } from "./品目CreateArgs";
import { 品目CreateValidate } from "./品目CreateValidate";
import { 品目CreateMapper } from "./品目CreateMapper";
import { db } from "../../../db";
import { 品目テーブル } from "../../../db/schema";

export const 品目CreateCommand = new GenericCommand<
  品目作成入力,
  品目CreateArgs,
  void
>({
  schema: 品目作成Schema,
  validate: 品目CreateValidate,
  mapper: 品目CreateMapper,
  command: async (args) => {
    await db.insert(品目テーブル).values(args);
  },
});
