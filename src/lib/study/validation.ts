import path from "node:path";

import { z } from "zod";

import { getAppSettings } from "@/lib/env";
import { parseDateInput } from "@/lib/date";
import {
  DEFAULT_STUDY_CATEGORY,
  MAX_IMAGE_COUNT,
  STUDY_CATEGORIES,
} from "@/lib/study/constants";
import type { StudyItemFormState } from "@/lib/study/types";

type ValidatedStudyItemInput = {
  autoSendEnabled: boolean;
  productName?: string;
  category: string;
  note: string;
  memo?: string;
  firstScheduledAt: Date;
  questionFiles: File[];
  answerFiles: File[];
  removeQuestionImages: boolean;
  removeAnswerImages: boolean;
};

const baseSchema = z
  .object({
    productName: z.string().max(120, "商品名は120文字以内で入力してください。").default(""),
    category: z.enum(STUDY_CATEGORIES, {
      error: "カテゴリを選択してください。",
    }).default(DEFAULT_STUDY_CATEGORY),
    note: z
      .string()
      .trim()
      .min(1, "問題文を入力してください。")
      .max(5000, "問題文は5000文字以内で入力してください。"),
    memo: z
      .string()
      .trim()
      .min(1, "解答を入力してください。")
      .max(5000, "解答は5000文字以内で入力してください。"),
    firstScheduledAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "初回送信予定日は必須です。"),
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
    category: String(formData.get("category") || DEFAULT_STUDY_CATEGORY),
    note: String(formData.get("note") || ""),
    memo: String(formData.get("memo") || ""),
    firstScheduledAt: String(formData.get("firstScheduledAt") || ""),
  });

  const questionFiles = formData
    .getAll("questionImages")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  const answerFiles = formData
    .getAll("answerImages")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  const allFiles = [...questionFiles, ...answerFiles];

  const fieldErrors: Record<string, string[]> = buildFieldErrors(parsed);
  const maxUploadSizeBytes = getAppSettings().maxUploadSizeBytes;

  if (questionFiles.length > MAX_IMAGE_COUNT) {
    fieldErrors.questionImages = ["問題文の画像は最大4枚までです。"];
  }

  if (answerFiles.length > MAX_IMAGE_COUNT) {
    fieldErrors.answerImages = ["解答の画像は最大4枚までです。"];
  }

  if (allFiles.some((file) => file.size > maxUploadSizeBytes)) {
    fieldErrors.questionImages = [
      `画像サイズは1枚あたり${getAppSettings().maxUploadSizeMb}MB以下にしてください。`,
    ];
    fieldErrors.answerImages = [
      `画像サイズは1枚あたり${getAppSettings().maxUploadSizeMb}MB以下にしてください。`,
    ];
  }

  if (allFiles.some((file) => !isAllowedImageFile(file))) {
    fieldErrors.questionImages = [
      "画像形式は jpeg / png / webp / gif / heic / heif に対応しています。",
    ];
    fieldErrors.answerImages = [
      "画像形式は jpeg / png / webp / gif / heic / heif に対応しています。",
    ];
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
      category: parsed.data.category,
      note: parsed.data.note,
      memo: parsed.data.memo,
      firstScheduledAt: parseDateInput(parsed.data.firstScheduledAt),
      questionFiles,
      answerFiles,
      removeQuestionImages: formData.get("removeQuestionImages") === "1",
      removeAnswerImages: formData.get("removeAnswerImages") === "1",
    },
  };
}
