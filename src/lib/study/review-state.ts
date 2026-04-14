import type {
  ConversationStateType,
  ItemStatus,
  ReviewActionType,
} from "@/generated/prisma/client";

import { scheduleNextReview } from "@/lib/date";
import type { LastResult } from "@/lib/study/types";

export type LineCommand = "answer" | "greatCorrect" | "correct" | "incorrect" | "manual" | "unknown";

export function normalizeLineCommand(text: string): LineCommand {
  const normalized = text.trim();

  if (normalized === "解答") {
    return "answer";
  }

  if (normalized === "正解") {
    return "correct";
  }

  if (normalized === "大正解") {
    return "greatCorrect";
  }

  if (normalized === "不正解") {
    return "incorrect";
  }

  if (normalized === "手動") {
    return "manual";
  }

  return "unknown";
}

export function canShowAnswer(state: ConversationStateType | null | undefined) {
  return state === "QUESTION_SENT" || state === "ANSWER_SHOWN";
}

export function canJudgeAnswer(state: ConversationStateType | null | undefined) {
  return state === "ANSWER_SHOWN";
}

export function getConversationStateAfterQuestionSent(): ConversationStateType {
  return "QUESTION_SENT";
}

export function getConversationStateAfterAnswerShown(
  state: ConversationStateType | null | undefined,
) {
  if (!canShowAnswer(state)) {
    return null;
  }

  return "ANSWER_SHOWN" as const;
}

export function getConversationStateAfterReviewResult() {
  return null;
}

export function calculateNextScheduledAtFromResult(
  result: "greatCorrect" | "correct" | "incorrect",
  baseDate: Date = new Date(),
) {
  return scheduleNextReview(
    result === "greatCorrect" ? 14 : result === "correct" ? 7 : 1,
    baseDate,
  );
}

export function getItemStatusAfterAnswerShown(): ItemStatus {
  return "ANSWER_SHOWN";
}

export function getItemStatusAfterReviewResult(
  result: "greatCorrect" | "correct" | "incorrect",
): ItemStatus {
  return result === "incorrect" ? "INCORRECT" : "CORRECT";
}

export function getLastResultFromLogs(
  logs: Array<{
    actionType: ReviewActionType;
  }>,
): LastResult {
  const latestResult = logs.find(
    (log) =>
      log.actionType === "GREAT_CORRECT" ||
      log.actionType === "CORRECT" ||
      log.actionType === "INCORRECT",
  );

  if (!latestResult) {
    return "unanswered";
  }

  return latestResult.actionType === "INCORRECT" ? "incorrect" : "correct";
}
