import type {
  ConversationStateType,
  ItemStatus,
  ReviewActionType,
} from "@/generated/prisma/client";

import { scheduleNextReview } from "@/lib/date";
import type { LastResult } from "@/lib/study/types";

export type LineCommand = "answer" | "correct" | "incorrect" | "manual" | "unknown";

export function normalizeLineCommand(text: string): LineCommand {
  const normalized = text.trim();

  if (normalized === "解答") {
    return "answer";
  }

  if (normalized === "正解") {
    return "correct";
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
  result: "correct" | "incorrect",
  baseDate: Date = new Date(),
) {
  return scheduleNextReview(result === "correct" ? 7 : 1, baseDate);
}

export function getItemStatusAfterAnswerShown(): ItemStatus {
  return "ANSWER_SHOWN";
}

export function getItemStatusAfterReviewResult(result: "correct" | "incorrect"): ItemStatus {
  return result === "correct" ? "CORRECT" : "INCORRECT";
}

export function getLastResultFromLogs(
  logs: Array<{
    actionType: ReviewActionType;
  }>,
): LastResult {
  const latestResult = logs.find(
    (log) => log.actionType === "CORRECT" || log.actionType === "INCORRECT",
  );

  if (!latestResult) {
    return "unanswered";
  }

  return latestResult.actionType === "CORRECT" ? "correct" : "incorrect";
}
