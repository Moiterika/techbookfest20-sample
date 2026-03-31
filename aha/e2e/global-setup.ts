import { execSync } from "child_process";
import postgres from "postgres";

const host = "db";
const port = 5432;
const user = "postgres";
const password = "password";
const testDb = "e2e_testdb";

export default async function globalSetup() {
  const sql = postgres({ host, port, username: user, password, database: "postgres" });

  // 既存接続を切断してから DROP → 再作成
  await sql.unsafe(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${testDb}' AND pid <> pg_backend_pid()`,
  );
  await sql.unsafe(`DROP DATABASE IF EXISTS ${testDb}`);
  await sql.unsafe(`CREATE DATABASE ${testDb}`);
  await sql.end();

  execSync("bunx drizzle-kit push --force", {
    cwd: process.cwd(),
    stdio: "inherit",
    env: {
      ...process.env,
      DB_NAME: testDb,
      DB_HOST: host,
      DB_PORT: String(port),
      DB_USER: user,
      DB_PASSWORD: password,
    },
  });
}
