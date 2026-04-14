import { ReviewActionType } from "@/generated/prisma/client";

export type ReviewLogSummary = {
  actionType: ReviewActionType;
  actionAt: Date;
};

export const ANSWERED_ACTION_TYPES = [
  ReviewActionType.GREAT_CORRECT,
  ReviewActionType.CORRECT,
  ReviewActionType.INCORRECT,
] as const;
export const STUDIED_ACTION_TYPES = [ReviewActionType.ANSWER_SHOWN, ...ANSWERED_ACTION_TYPES] as const;

function isAnsweredActionType(actionType: ReviewActionType) {
  return (
    actionType === ReviewActionType.GREAT_CORRECT ||
    actionType === ReviewActionType.CORRECT ||
    actionType === ReviewActionType.INCORRECT
  );
}

function isStudiedActionType(actionType: ReviewActionType) {
  return actionType === ReviewActionType.ANSWER_SHOWN || isAnsweredActionType(actionType);
}

export function getAnsweredCount(logs: ReviewLogSummary[]) {
  return logs.filter((log) => isAnsweredActionType(log.actionType)).length;
}

export function getCorrectCount(logs: ReviewLogSummary[]) {
  return logs.filter(
    (log) =>
      log.actionType === ReviewActionType.GREAT_CORRECT ||
      log.actionType === ReviewActionType.CORRECT,
  ).length;
}

export function getLastStudiedAt(logs: ReviewLogSummary[]) {
  return logs.find((log) => isStudiedActionType(log.actionType))?.actionAt || null;
}

export function getAccuracy(logs: ReviewLogSummary[]) {
  const answeredCount = getAnsweredCount(logs);

  if (answeredCount === 0) {
    return 0;
  }

  return getCorrectCount(logs) / answeredCount;
}

type WeakCategoryCandidate = {
  questionNumber: number;
  isFavorite: boolean;
  reviewLogs: ReviewLogSummary[];
};

export function sortWeakCategoryCandidates<T extends WeakCategoryCandidate>(items: T[]) {
  return items.slice().sort((left, right) => {
    const leftAccuracy = getAccuracy(left.reviewLogs);
    const rightAccuracy = getAccuracy(right.reviewLogs);

    if (leftAccuracy !== rightAccuracy) {
      return leftAccuracy - rightAccuracy;
    }

    const leftCorrectCount = getCorrectCount(left.reviewLogs);
    const rightCorrectCount = getCorrectCount(right.reviewLogs);

    if (leftCorrectCount !== rightCorrectCount) {
      return leftCorrectCount - rightCorrectCount;
    }

    const leftLastStudiedAt = getLastStudiedAt(left.reviewLogs)?.getTime() ?? Number.NEGATIVE_INFINITY;
    const rightLastStudiedAt =
      getLastStudiedAt(right.reviewLogs)?.getTime() ?? Number.NEGATIVE_INFINITY;

    if (leftLastStudiedAt !== rightLastStudiedAt) {
      return leftLastStudiedAt - rightLastStudiedAt;
    }

    if (left.isFavorite !== right.isFavorite) {
      return left.isFavorite ? -1 : 1;
    }

    return left.questionNumber - right.questionNumber;
  });
}
