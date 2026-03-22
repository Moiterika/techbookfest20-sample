import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    host: "db",
    port: 5432,
    database: "devdb",
    user: "postgres",
    password: "password",
  },
});
