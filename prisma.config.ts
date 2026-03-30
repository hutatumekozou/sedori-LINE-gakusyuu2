import "dotenv/config";

import path from "node:path";

import { defineConfig, env } from "prisma/config";

function getResolvedDatabaseUrl() {
  const rawUrl = env("DATABASE_URL");
  const localSharedDataRoot = process.env.LOCAL_SHARED_DATA_ROOT?.trim();

  if (
    localSharedDataRoot &&
    (rawUrl.startsWith("file:./") || rawUrl.startsWith("file:../"))
  ) {
    const relativePath = rawUrl.slice("file:".length);
    return `file:${path.resolve(localSharedDataRoot, relativePath)}`;
  }

  return rawUrl;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: getResolvedDatabaseUrl(),
  },
});
