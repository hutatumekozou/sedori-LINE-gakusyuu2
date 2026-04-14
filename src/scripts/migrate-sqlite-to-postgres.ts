import "dotenv/config";

import { File } from "node:buffer";
import path from "node:path";

import Database from "better-sqlite3";

import { prisma } from "@/lib/prisma";
import {
  getMimeTypeFromPath,
  readStoredImage,
  saveUploadedImages,
} from "@/lib/storage/local";
import { ProductStudyImageKind } from "@/generated/prisma/client";

type SqliteUserRow = {
  id: number;
  lineUserId: string | null;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
};

type SqliteStudyItemRow = {
  id: number;
  userId: number;
  questionNumber: number;
  autoSendEnabled: number;
  isFavorite: number;
  deletedAt: string | null;
  productName: string | null;
  brandName: string | null;
  category: string | null;
  note: string;
  memo: string | null;
  firstScheduledAt: string;
  nextScheduledAt: string;
  status: string;
  summary: string;
  question: string;
  answer: string;
  explanation: string;
  difficulty: string;
  tags: string;
  keyPoints: string;
  createdAt: string;
  updatedAt: string;
};

type SqliteProductStudyImageRow = {
  id: number;
  itemId: number;
  kind: ProductStudyImageKind;
  imagePath: string;
  sortOrder: number;
  createdAt: string;
};

type SqliteReviewLogRow = {
  id: number;
  itemId: number;
  userId: number;
  actionType: string;
  actionAt: string;
  rawText: string | null;
  createdAt: string;
};

type SqliteActiveConversationStateRow = {
  id: number;
  userId: number;
  itemId: number;
  state: string;
  questionLineMessageId: string | null;
  answerLineMessageId: string | null;
  updatedAt: string;
};

type SqliteGeminiApiCallLogRow = {
  id: number;
  userId: number | null;
  status: string;
  model: string;
  promptLength: number;
  imageCount: number;
  responseLength: number | null;
  errorMessage: string | null;
  createdAt: string;
};

type SqliteLineApiCallLogRow = {
  id: number;
  userId: number | null;
  itemId: number | null;
  kind: string;
  status: string;
  targetLineUserId: string | null;
  messageCount: number;
  estimatedBillableCount: number;
  errorMessage: string | null;
  createdAt: string;
};

function getSqliteDatabasePath() {
  return process.env.SQLITE_DATABASE_PATH?.trim() || path.join(process.cwd(), "prisma", "dev.db");
}

function parseJsonStringArray(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toDate(value: string | null) {
  return value ? new Date(value) : null;
}

async function migrateImages(rows: SqliteProductStudyImageRow[]) {
  const migratedRows: Array<SqliteProductStudyImageRow> = [];

  for (const row of rows) {
    const buffer = await readStoredImage(row.imagePath);
    const file = new File([buffer], path.basename(row.imagePath), {
      type: getMimeTypeFromPath(row.imagePath),
    });
    const [saved] = await saveUploadedImages([file], row.kind);

    if (!saved) {
      throw new Error(`画像の移行に失敗しました: ${row.imagePath}`);
    }

    migratedRows.push({
      ...row,
      imagePath: saved.imagePath,
    });
  }

  return migratedRows;
}

async function resetPostgresData() {
  await prisma.lineApiCallLog.deleteMany();
  await prisma.geminiApiCallLog.deleteMany();
  await prisma.activeConversationState.deleteMany();
  await prisma.reviewLog.deleteMany();
  await prisma.productStudyImage.deleteMany();
  await prisma.productStudyItem.deleteMany();
  await prisma.user.deleteMany();
}

async function syncSequences() {
  const tables = [
    "User",
    "ProductStudyItem",
    "ProductStudyImage",
    "ReviewLog",
    "ActiveConversationState",
    "GeminiApiCallLog",
    "LineApiCallLog",
  ];

  for (const table of tables) {
    await prisma.$executeRawUnsafe(`
      SELECT setval(
        pg_get_serial_sequence('"${table}"', 'id'),
        COALESCE((SELECT MAX(id) FROM "${table}"), 1),
        EXISTS (SELECT 1 FROM "${table}")
      );
    `);
  }
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL が未設定です。Postgres の接続文字列を設定してください。");
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    throw new Error("BLOB_READ_WRITE_TOKEN が未設定です。Vercel Blob を接続してから実行してください。");
  }

  const sqlitePath = getSqliteDatabasePath();
  const sqlite = new Database(sqlitePath);

  try {
    const users = sqlite.prepare<SqliteUserRow>('SELECT * FROM "User" ORDER BY id').all();
    const items = sqlite
      .prepare<SqliteStudyItemRow>('SELECT * FROM "ProductStudyItem" ORDER BY id')
      .all();
    const images = sqlite
      .prepare<SqliteProductStudyImageRow>('SELECT * FROM "ProductStudyImage" ORDER BY id')
      .all();
    const reviewLogs = sqlite
      .prepare<SqliteReviewLogRow>('SELECT * FROM "ReviewLog" ORDER BY id')
      .all();
    const activeStates = sqlite
      .prepare<SqliteActiveConversationStateRow>('SELECT * FROM "ActiveConversationState" ORDER BY id')
      .all();
    const geminiLogs = sqlite
      .prepare<SqliteGeminiApiCallLogRow>('SELECT * FROM "GeminiApiCallLog" ORDER BY id')
      .all();
    const lineLogs = sqlite
      .prepare<SqliteLineApiCallLogRow>('SELECT * FROM "LineApiCallLog" ORDER BY id')
      .all();

    const migratedImages = await migrateImages(images);

    await resetPostgresData();

    if (users.length > 0) {
      await prisma.user.createMany({
        data: users.map((row) => ({
          id: row.id,
          lineUserId: row.lineUserId,
          displayName: row.displayName,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
        })),
      });
    }

    if (items.length > 0) {
      await prisma.productStudyItem.createMany({
        data: items.map((row) => ({
          id: row.id,
          userId: row.userId,
          questionNumber: row.questionNumber,
          autoSendEnabled: Boolean(row.autoSendEnabled),
          isFavorite: Boolean(row.isFavorite),
          deletedAt: toDate(row.deletedAt),
          productName: row.productName,
          brandName: row.brandName,
          category: row.category,
          note: row.note,
          memo: row.memo,
          firstScheduledAt: new Date(row.firstScheduledAt),
          nextScheduledAt: new Date(row.nextScheduledAt),
          status: row.status as never,
          summary: row.summary,
          question: row.question,
          answer: row.answer,
          explanation: row.explanation,
          difficulty: row.difficulty,
          tags: parseJsonStringArray(row.tags),
          keyPoints: parseJsonStringArray(row.keyPoints),
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
        })),
      });
    }

    if (migratedImages.length > 0) {
      await prisma.productStudyImage.createMany({
        data: migratedImages.map((row) => ({
          id: row.id,
          itemId: row.itemId,
          kind: row.kind,
          imagePath: row.imagePath,
          sortOrder: row.sortOrder,
          createdAt: new Date(row.createdAt),
        })),
      });
    }

    if (reviewLogs.length > 0) {
      await prisma.reviewLog.createMany({
        data: reviewLogs.map((row) => ({
          id: row.id,
          itemId: row.itemId,
          userId: row.userId,
          actionType: row.actionType as never,
          actionAt: new Date(row.actionAt),
          rawText: row.rawText,
          createdAt: new Date(row.createdAt),
        })),
      });
    }

    if (activeStates.length > 0) {
      await prisma.activeConversationState.createMany({
        data: activeStates.map((row) => ({
          id: row.id,
          userId: row.userId,
          itemId: row.itemId,
          state: row.state as never,
          questionLineMessageId: row.questionLineMessageId,
          answerLineMessageId: row.answerLineMessageId,
          updatedAt: new Date(row.updatedAt),
        })),
      });
    }

    if (geminiLogs.length > 0) {
      await prisma.geminiApiCallLog.createMany({
        data: geminiLogs.map((row) => ({
          id: row.id,
          userId: row.userId,
          status: row.status as never,
          model: row.model,
          promptLength: row.promptLength,
          imageCount: row.imageCount,
          responseLength: row.responseLength,
          errorMessage: row.errorMessage,
          createdAt: new Date(row.createdAt),
        })),
      });
    }

    if (lineLogs.length > 0) {
      await prisma.lineApiCallLog.createMany({
        data: lineLogs.map((row) => ({
          id: row.id,
          userId: row.userId,
          itemId: row.itemId,
          kind: row.kind as never,
          status: row.status as never,
          targetLineUserId: row.targetLineUserId,
          messageCount: row.messageCount,
          estimatedBillableCount: row.estimatedBillableCount,
          errorMessage: row.errorMessage,
          createdAt: new Date(row.createdAt),
        })),
      });
    }

    await syncSequences();

    console.info("SQLite to Postgres migration completed", {
      sqlitePath,
      users: users.length,
      items: items.length,
      images: migratedImages.length,
      reviewLogs: reviewLogs.length,
      activeStates: activeStates.length,
      geminiLogs: geminiLogs.length,
      lineLogs: lineLogs.length,
    });
  } finally {
    sqlite.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("SQLite to Postgres migration failed", error);
  process.exitCode = 1;
});
