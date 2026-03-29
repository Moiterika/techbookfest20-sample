import { defineConfig } from "@playwright/test";

const e2ePort = 4322;

const testDbEnv = {
  DB_NAME: "e2e_testdb",
  DB_HOST: "db",
  DB_PORT: "5432",
  DB_USER: "postgres",
  DB_PASSWORD: "password",
};

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${e2ePort}`,
    headless: true,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: `bunx --bun astro dev --port ${e2ePort}`,
    url: `http://localhost:${e2ePort}`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: testDbEnv,
  },
});
