import { execSync } from "child_process";
import postgres from "postgres";

const host = "db";
const port = 5432;
const user = "postgres";
const password = "password";
const testDb = "e2e_testdb";

export default async function globalSetup() {
  const sql = postgres({ host, port, username: user, password, database: "postgres" });

  const [{ exists }] = await sql<[{ exists: boolean }]>`
    SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = ${testDb})
  `;
  if (!exists) {
    await sql.unsafe(`CREATE DATABASE ${testDb}`);
  }
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
