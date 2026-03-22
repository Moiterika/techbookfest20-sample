import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres({
  host: "db",
  port: 5432,
  database: "devdb",
  username: "postgres",
  password: "password",
});

export const db = drizzle(client, { schema });
