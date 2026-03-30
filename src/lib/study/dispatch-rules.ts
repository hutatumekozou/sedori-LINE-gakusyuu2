import { formatDebugDateTime, getAppDayStart, getLatestDispatchCheckpoint } from "@/lib/date";

export type DispatchSkipReason = "not_due_today" | "already_sent_today";

export function isDueForDispatch(nextScheduledAt: Date, now: Date = new Date()) {
  return nextScheduledAt <= getLatestDispatchCheckpoint(now);
}

export function wasSentToday(
  latestSentAt: Date | null | undefined,
  now: Date = new Date(),
) {
  if (!latestSentAt) {
    return false;
  }

  return latestSentAt >= getAppDayStart(now);
}

export function getDispatchDecision({
  nextScheduledAt,
  latestSentAt,
  now = new Date(),
  force = false,
}: {
  nextScheduledAt: Date;
  latestSentAt?: Date | null;
  now?: Date;
  force?: boolean;
}) {
  if (force) {
    return {
      shouldSend: true as const,
    };
  }

  if (!isDueForDispatch(nextScheduledAt, now)) {
    return {
      shouldSend: false as const,
      reason: "not_due_today" as const,
    };
  }

  if (wasSentToday(latestSentAt, now)) {
    return {
      shouldSend: false as const,
      reason: "already_sent_today" as const,
    };
  }

  return {
    shouldSend: true as const,
  };
}

export function buildDispatchDecisionDebugInfo({
  itemId,
  questionNumber,
  autoSendEnabled,
  status,
  nextScheduledAt,
  latestSentAt,
  now = new Date(),
}: {
  itemId: number;
  questionNumber: number;
  autoSendEnabled: boolean;
  status: string;
  nextScheduledAt: Date;
  latestSentAt?: Date | null;
  now?: Date;
}) {
  const todayStart = getAppDayStart(now);
  const dispatchCheckpoint = getLatestDispatchCheckpoint(now);
  const nextScheduledAtLteDispatchCheckpoint = nextScheduledAt <= dispatchCheckpoint;
  const latestSentIsToday = latestSentAt ? latestSentAt >= todayStart : false;

  return {
    itemId,
    questionNumber,
    autoSendEnabled,
    status,
    now: {
      utc: now.toISOString(),
      jst: formatDebugDateTime(now),
    },
    todayStart: {
      utc: todayStart.toISOString(),
      jst: formatDebugDateTime(todayStart),
    },
    dispatchCheckpoint: {
      utc: dispatchCheckpoint.toISOString(),
      jst: formatDebugDateTime(dispatchCheckpoint),
    },
    nextScheduledAt: {
      utc: nextScheduledAt.toISOString(),
      jst: formatDebugDateTime(nextScheduledAt),
    },
    latestSentLog: latestSentAt
      ? {
          utc: latestSentAt.toISOString(),
          jst: formatDebugDateTime(latestSentAt),
        }
      : null,
    comparisons: {
      nextScheduledAtLteDispatchCheckpoint,
      latestSentIsToday,
      jst: {
        nextScheduledAtLteDispatchCheckpoint:
          `${formatDebugDateTime(nextScheduledAt)} <= ${formatDebugDateTime(dispatchCheckpoint)} => ${nextScheduledAtLteDispatchCheckpoint}`,
        latestSentIsToday: latestSentAt
          ? `${formatDebugDateTime(latestSentAt)} >= ${formatDebugDateTime(todayStart)} => ${latestSentIsToday}`
          : `latestSentLog is null >= ${formatDebugDateTime(todayStart)} => false`,
      },
    },
  };
}

export function getDispatchSkipMessage(reason: DispatchSkipReason) {
  if (reason === "already_sent_today") {
    return "本日はすでに送信済みです。";
  }

  return "まだ本日の送信対象ではありません。";
}

export function resolveLineTargetUserId(
  itemLineUserId: string | null | undefined,
  defaultLineUserId: string | null | undefined,
) {
  return itemLineUserId || defaultLineUserId || null;
}

export function sortDispatchCandidates<
  T extends {
    questionNumber: number;
    nextScheduledAt: Date;
    latestSentAt?: Date | null;
    latestSolvedAt?: Date | null;
  },
>(items: T[]) {
  return items.slice().sort((left, right) => {
    const unansweredLeft =
      !!left.latestSentAt &&
      (!left.latestSolvedAt || left.latestSolvedAt.getTime() < left.latestSentAt.getTime());
    const unansweredRight =
      !!right.latestSentAt &&
      (!right.latestSolvedAt || right.latestSolvedAt.getTime() < right.latestSentAt.getTime());

    if (unansweredLeft !== unansweredRight) {
      return unansweredLeft ? -1 : 1;
    }

    if (unansweredLeft && unansweredRight) {
      if (left.nextScheduledAt.getTime() !== right.nextScheduledAt.getTime()) {
        return left.nextScheduledAt.getTime() - right.nextScheduledAt.getTime();
      }

      const sentLeft = left.latestSentAt?.getTime() ?? Number.NEGATIVE_INFINITY;
      const sentRight = right.latestSentAt?.getTime() ?? Number.NEGATIVE_INFINITY;

      if (sentLeft !== sentRight) {
        return sentLeft - sentRight;
      }

      return left.questionNumber - right.questionNumber;
    }

    const solvedLeft = left.latestSolvedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    const solvedRight = right.latestSolvedAt?.getTime() ?? Number.NEGATIVE_INFINITY;

    if (solvedLeft !== solvedRight) {
      return solvedRight - solvedLeft;
    }

    if (left.nextScheduledAt.getTime() !== right.nextScheduledAt.getTime()) {
      return left.nextScheduledAt.getTime() - right.nextScheduledAt.getTime();
    }

    return left.questionNumber - right.questionNumber;
  });
}
