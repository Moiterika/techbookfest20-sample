/**
 * Query: 読み取り操作（副作用なし）
 * TInput: 検索条件などの入力
 * TOutput: 取得結果
 */
export interface Query<TInput, TOutput> {
  execute(input: TInput): Promise<TOutput>;
}

/**
 * Command: 書き込み操作（副作用あり）
 * Create, Update, Delete すべてをこのインターフェースで扱う。
 * TInput: 操作対象のデータ
 * TOutput: 操作結果
 */
export interface Command<TInput, TOutput> {
  execute(input: TInput): Promise<TOutput>;
}
