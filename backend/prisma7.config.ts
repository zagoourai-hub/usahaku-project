import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Local dev reads .env; containers/CI inject env vars directly.
if (existsSync(".env")) process.loadEnvFile();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
