import { getAppDayEnd, getAppDayStart } from "@/lib/date";

export type DispatchSkipReason = "not_due_today" | "already_sent_today";

export function isDueForDispatch(nextScheduledAt: Date, now: Date = new Date()) {
  return nextScheduledAt <= getAppDayEnd(now);
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
