import type { ItemStatus } from "@/generated/prisma/client";

export type LastResult = "correct" | "incorrect" | "unanswered";

export type StudyItemFormState = {
  success: boolean;
  message?: string;
  fieldErrors: Record<string, string[]>;
};

export const emptyStudyItemFormState: StudyItemFormState = {
  success: false,
  fieldErrors: {},
};

export type StudyItemFormDefaults = {
  autoSendEnabled?: boolean;
  productName?: string | null;
  category?: string | null;
  note?: string | null;
  memo?: string | null;
  firstScheduledAt: string;
};

export type StudyFormImagePreview = {
  id: number;
  url: string;
};

export type StudyItemFilters = {
  query?: string;
  status?: ItemStatus | "ALL";
  category?: string;
  sendMode?: "ALL" | "AUTO" | "MANUAL";
  elapsedDaysOrder?: "NONE" | "ASC" | "DESC";
  favoriteOnly?: boolean;
  todayOnly?: boolean;
};
