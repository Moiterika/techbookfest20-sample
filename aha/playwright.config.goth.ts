/**
 * GoTH サーバーに対して e2e テストを実行する設定
 *
 *   bun run test:e2e:goth
 */
import { defineConfig } from "@playwright/test";

const e2ePort = 4322;

const testDbEnv = {
  DB_NAME: "e2e_testdb",
  DB_HOST: "db",
  DB_PORT: "5432",
  DB_USER: "postgres",
  DB_PASSWORD: "password",
  APP_PORT: String(e2ePort),
};

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${e2ePort}`,
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: `cd ../goth && go run ./cmd/web`,
    url: `http://localhost:${e2ePort}`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: testDbEnv,
  },
});
