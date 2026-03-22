import path from "node:path";

import { z } from "zod";

import { getAppSettings } from "@/lib/env";
import { parseDateInput } from "@/lib/date";
import { MAX_IMAGE_COUNT } from "@/lib/study/constants";
import type { StudyItemFormState } from "@/lib/study/types";

type ValidationMode = "create" | "update";

type ValidatedStudyItemInput = {
  autoSendEnabled: boolean;
  productName?: string;
  brandName?: string;
  note: string;
  memo?: string;
  firstScheduledAt: Date;
  files: File[];
};

const baseSchema = z
  .object({
    productName: z.string().max(120, "商品名は120文字以内で入力してください。").default(""),
    brandName: z.string().max(120, "ブランド名は120文字以内で入力してください。").default(""),
    note: z.string().max(5000, "補足情報は5000文字以内で入力してください。").default(""),
    memo: z.string().max(5000, "自由メモは5000文字以内で入力してください。").default(""),
    firstScheduledAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "初回送信予定日は必須です。"),
  })
  .superRefine((value, ctx) => {
    const hasMinimumInfo = [value.productName, value.brandName, value.note].some(
      (item) => item.trim().length > 0,
    );

    if (!hasMinimumInfo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["note"],
        message: "補足情報または商品情報を少なくとも1つ入力してください。",
      });
    }
  });

function toOptionalString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildFieldErrors(
  validationResult: ReturnType<typeof baseSchema.safeParse>,
): Record<string, string[]> {
  if (validationResult.success) {
    return {};
  }

  return validationResult.error.flatten().fieldErrors;
}

function isAllowedImageFile(file: File) {
  const extension = path.extname(file.name).toLowerCase();
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"];
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
  ];

  return allowedMimeTypes.includes(file.type) || allowedExtensions.includes(extension);
}

export function validationFailure(
  message: string,
  fieldErrors: Record<string, string[]> = {},
): StudyItemFormState {
  return {
    success: false,
    message,
    fieldErrors,
  };
}

export function validationSuccess(message: string): StudyItemFormState {
  return {
    success: true,
    message,
    fieldErrors: {},
  };
}

export function validateStudyItemForm(
  formData: FormData,
  mode: ValidationMode,
):
  | {
      success: true;
      data: ValidatedStudyItemInput;
    }
  | {
      success: false;
      state: StudyItemFormState;
    } {
  const parsed = baseSchema.safeParse({
    productName: String(formData.get("productName") || ""),
    brandName: String(formData.get("brandName") || ""),
    note: String(formData.get("note") || ""),
    memo: String(formData.get("memo") || ""),
    firstScheduledAt: String(formData.get("firstScheduledAt") || ""),
  });

  const files = formData
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  const fieldErrors: Record<string, string[]> = buildFieldErrors(parsed);
  const maxUploadSizeBytes = getAppSettings().maxUploadSizeBytes;

  if (mode === "create" && files.length === 0) {
    fieldErrors.images = ["画像を1〜4枚アップロードしてください。"];
  }

  if (files.length > MAX_IMAGE_COUNT) {
    fieldErrors.images = ["画像は最大4枚までです。"];
  }

  if (files.some((file) => file.size > maxUploadSizeBytes)) {
    fieldErrors.images = [
      `画像サイズは1枚あたり${getAppSettings().maxUploadSizeMb}MB以下にしてください。`,
    ];
  }

  if (files.some((file) => !isAllowedImageFile(file))) {
    fieldErrors.images = ["画像形式は jpeg / png / webp / gif / heic / heif に対応しています。"];
  }

  if (!parsed.success || Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      state: validationFailure(
        "入力内容に不備があります。各項目を確認してください。",
        fieldErrors,
      ),
    };
  }

  return {
    success: true,
    data: {
      autoSendEnabled: formData.get("autoSendEnabled") === "1",
      productName: toOptionalString(parsed.data.productName),
      brandName: toOptionalString(parsed.data.brandName),
      note: parsed.data.note.trim(),
      memo: toOptionalString(parsed.data.memo),
      firstScheduledAt: parseDateInput(parsed.data.firstScheduledAt),
      files,
    },
  };
}
