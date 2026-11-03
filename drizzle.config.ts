import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle", // migraciones SQL versionadas en Git
  dbCredentials: { url: process.env.DATABASE_URL ?? "file:./data/sigr.db" },
});
