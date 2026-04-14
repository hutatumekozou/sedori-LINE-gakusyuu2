import path from "node:path";

import { z } from "zod";

function getMissingEnvNames(names: string[]) {
  return names.filter((name) => !process.env[name]?.trim());
}

function buildMissingEnvMessage(label: string, names: string[]) {
  return `${label}の設定が不足しています。${names.join(" / ")} を確認してください。`;
}

export function getAppSettings() {
  const parsed = z
    .object({
      APP_TIMEZONE: z.string().trim().default("Asia/Tokyo"),
      APP_BASE_URL: z.string().trim().optional(),
      UPLOAD_STORAGE_DIR: z.string().trim().optional(),
      MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().default(4),
      GEMINI_MODEL: z.string().trim().default("gemini-2.5-flash"),
    })
    .parse(process.env);

  return {
    appTimeZone: parsed.APP_TIMEZONE,
    appBaseUrl: parsed.APP_BASE_URL?.trim() || null,
    uploadStorageDir: parsed.UPLOAD_STORAGE_DIR?.trim() || null,
    maxUploadSizeMb: parsed.MAX_UPLOAD_SIZE_MB,
    maxUploadSizeBytes: parsed.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
    geminiModel: parsed.GEMINI_MODEL,
  };
}

export function getResolvedDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL が設定されていません。Postgres の接続文字列を設定してください。");
  }

  return databaseUrl;
}

export function getResolvedUploadStorageDir() {
  const configuredPath = getAppSettings().uploadStorageDir;

  if (configuredPath) {
    return path.resolve(configuredPath);
  }

  return path.join(process.cwd(), "storage", "uploads");
}

export function getPublicAppUrl() {
  const appBaseUrl = getAppSettings().appBaseUrl;

  if (!appBaseUrl) {
    throw new Error(
      "公開URLが未設定です。APP_BASE_URL に現在有効な HTTPS 公開URL を設定してください。",
    );
  }

  let parsed: URL;

  try {
    parsed = new URL(appBaseUrl);
  } catch {
    throw new Error("APP_BASE_URL の形式が不正です。https:// から始まるURLを設定してください。");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("APP_BASE_URL は https:// から始まる公開URLを設定してください。");
  }

  return parsed.toString().replace(/\/$/, "");
}

export function getGeminiConfig() {
  const missingNames = getMissingEnvNames(["GEMINI_API_KEY"]);

  if (missingNames.length > 0) {
    throw new Error(buildMissingEnvMessage("Gemini", missingNames));
  }

  return {
    apiKey: process.env.GEMINI_API_KEY!.trim(),
    model: process.env.GEMINI_MODEL?.trim() || getAppSettings().geminiModel,
  };
}

export function getLineMessagingConfig() {
  const missingNames = getMissingEnvNames(["LINE_CHANNEL_ACCESS_TOKEN"]);

  if (missingNames.length > 0) {
    throw new Error(buildMissingEnvMessage("LINE返信/送信", missingNames));
  }

  return {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!.trim(),
  };
}

export function getLineWebhookSecret() {
  const missingNames = getMissingEnvNames(["LINE_CHANNEL_SECRET"]);

  if (missingNames.length > 0) {
    throw new Error(buildMissingEnvMessage("LINE webhook", missingNames));
  }

  return process.env.LINE_CHANNEL_SECRET!.trim();
}

export function getDefaultLineUserId() {
  return process.env.LINE_DEFAULT_USER_ID?.trim() || null;
}

export function getCronSecret() {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    throw new Error("CRON_SECRET が設定されていません。");
  }

  return secret;
}
