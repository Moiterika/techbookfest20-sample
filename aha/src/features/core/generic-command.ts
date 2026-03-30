import type { z } from "zod";
import type { Command } from "./interfaces";

/**
 * 汎用 Command ユースケース
 * TInput: Zod で検証された入力型
 * TArgs: Repository に渡す型
 * TResult: Repository から返ってくる型
 * TOutput: 最終的なResponse型（省略時は TResult と同じ）
 */
export class GenericCommand<
  TInput,
  TArgs,
  TResult,
  TOutput = TResult,
> implements Command<unknown, TOutput> {
  constructor(
    private config: {
      schema: z.ZodType<TInput>;
      validate?: (input: TInput) => Promise<void> | void;
      mapper: (input: TInput) => TArgs;
      command: (args: TArgs) => Promise<TResult>;
      mapToRes?: (result: TResult) => TOutput;
    },
  ) {}

  async execute(rawInput: unknown): Promise<TOutput> {
    const input = this.config.schema.parse(rawInput);
    if (this.config.validate) {
      await this.config.validate(input);
    }
    const args = this.config.mapper(input);
    const result = await this.config.command(args);
    return this.config.mapToRes
      ? this.config.mapToRes(result)
      : (result as unknown as TOutput);
  }
}
