import type { z } from "zod";
import type { Query } from "./interfaces";

/**
 * 汎用 Query ユースケース
 * TInput: Zod で検証された入力型
 * TResult: Repository から返ってくる型
 * TOutput: 最終的なResponse型（省略時は TResult と同じ）
 */
export class GenericQuery<TInput, TResult, TOutput = TResult> implements Query<
  unknown,
  TOutput
> {
  constructor(
    private config: {
      schema: z.ZodType<TInput>;
      query: (input: TInput) => Promise<TResult>;
      mapToRes?: (result: TResult) => TOutput;
    },
  ) {}

  async execute(rawInput: unknown): Promise<TOutput> {
    const input = this.config.schema.parse(rawInput);
    const result = await this.config.query(input);
    return this.config.mapToRes
      ? this.config.mapToRes(result)
      : (result as unknown as TOutput);
  }
}
