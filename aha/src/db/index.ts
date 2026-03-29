import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres({
  host: process.env.DB_HOST ?? "db",
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? "devdb",
  username: process.env.DB_USER ?? "postgres",
  password: process.env.DB_PASSWORD ?? "password",
});

export const db = drizzle(client, { schema });
