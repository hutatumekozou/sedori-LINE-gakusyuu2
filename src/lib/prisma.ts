import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { getResolvedDatabaseUrl } from "@/lib/env";
import { PrismaClient } from "@/generated/prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
  var prismaDatabaseUrl: string | undefined;
}

const databaseUrl = getResolvedDatabaseUrl();

if (global.prisma && global.prismaDatabaseUrl && global.prismaDatabaseUrl !== databaseUrl) {
  void global.prisma.$disconnect().catch(() => undefined);
  global.prisma = undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: databaseUrl,
    }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
  global.prismaDatabaseUrl = databaseUrl;
}
