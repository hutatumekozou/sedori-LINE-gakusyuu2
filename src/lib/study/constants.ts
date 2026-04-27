import type { ItemStatus, ReviewActionType } from "@/generated/prisma/client";

export const MAX_IMAGE_COUNT = 4;
export const STUDY_CATEGORIES = [
  "年式",
  "ブランド深掘り",
  "メンズアパレル",
  "レディースアパレル",
  "スポーツウェア",
  "財布",
  "バッグ",
  "サングラス",
  "時計",
  "アクセサリー",
  "帽子",
  "手袋",
  "マフラー",
  "靴",
  "キッズ",
  "家電",
  "家具",
  "リペア",
  "自分の実売",
  "その他",
] as const;
export const DEFAULT_STUDY_CATEGORY = "その他";

export const STATUS_LABELS: Record<ItemStatus, string> = {
  PENDING: "送信待ち",
  QUESTION_SENT: "出題中",
  ANSWER_SHOWN: "出題中",
  CORRECT: "正解",
  INCORRECT: "不正解",
};

export const STATUS_STYLES: Record<ItemStatus, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  QUESTION_SENT: "bg-amber-100 text-amber-800",
  ANSWER_SHOWN: "bg-amber-100 text-amber-800",
  CORRECT: "bg-emerald-100 text-emerald-800",
  INCORRECT: "bg-rose-100 text-rose-800",
};

export const DIFFICULTY_LABELS = {
  easy: "やさしめ",
  medium: "標準",
  hard: "難しめ",
} as const;

export const DIFFICULTY_STYLES: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  hard: "bg-rose-100 text-rose-800",
};

export const LAST_RESULT_LABELS = {
  correct: "正解",
  incorrect: "不正解",
  unanswered: "未回答",
} as const;

export const LAST_RESULT_STYLES = {
  correct: "text-emerald-700",
  incorrect: "text-rose-700",
  unanswered: "text-slate-500",
} as const;

export const REVIEW_ACTION_LABELS: Record<ReviewActionType, string> = {
  SENT: "送信",
  ANSWER_SHOWN: "解答表示",
  GREAT_CORRECT: "大正解記録",
  CORRECT: "正解記録",
  INCORRECT: "不正解記録",
};
