# E2Eテスト

## 実行方法

```bash
bun run test:e2e        # ヘッドレス実行
bun run test:e2e:ui     # Playwright UI モード
```

## DB分離

E2Eテストは開発用DB（`devdb`）とは別の `e2e_testdb` を使用する。

### 仕組み

- `src/db/index.ts` と `drizzle.config.ts` のDB接続情報は環境変数（`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`）で切り替え可能。未設定時は `devdb` にフォールバックする
- Playwright の `globalSetup`（`e2e/global-setup.ts`）がテスト実行前に以下を行う:
  1. `e2e_testdb` が存在しなければ作成
  2. `drizzle-kit push --force` でスキーマを同期
- テスト後に `e2e_testdb` は削除しない（デバッグ用にデータを残す）

### ポート

E2Eテストは開発サーバー（4321）と競合しないよう、ポート **4322** で別プロセスとして起動する。開発サーバーを起動したままテストを実行できる。

### 関連ファイル

| ファイル | 役割 |
|---------|------|
| `playwright.config.ts` | globalSetup指定、webServerにテストDB用の環境変数を渡す |
| `e2e/global-setup.ts` | テストDB作成 + スキーマ適用 |
| `src/db/index.ts` | 環境変数によるDB接続先の切り替え |
| `drizzle.config.ts` | 同上（drizzle-kit用） |
