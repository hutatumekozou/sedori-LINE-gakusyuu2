import { describe, expect, it } from "vitest";

import {
  buildDispatchDecisionDebugInfo,
  getDispatchDecision,
  getDispatchSkipMessage,
  isDueForDispatch,
  resolveLineTargetUserId,
  sortDispatchCandidates,
  wasSentToday,
} from "@/lib/study/dispatch-rules";

describe("dispatch-rules", () => {
  const now = new Date("2026-03-18T12:00:00+09:00");

  it("judges due items on JST correctly", () => {
    expect(isDueForDispatch(new Date("2026-03-18T00:00:00+09:00"), now)).toBe(true);
    expect(isDueForDispatch(new Date("2026-03-18T12:00:00+09:00"), now)).toBe(true);
    expect(isDueForDispatch(new Date("2026-03-19T00:00:00+09:00"), now)).toBe(false);
  });

  it("does not dispatch today's noon item before 12:00 JST", () => {
    expect(
      isDueForDispatch(
        new Date("2026-03-18T12:00:00+09:00"),
        new Date("2026-03-18T11:59:00+09:00"),
      ),
    ).toBe(false);
  });

  it("prevents duplicate sends on the same JST day", () => {
    expect(wasSentToday(new Date("2026-03-18T09:00:00+09:00"), now)).toBe(true);
    expect(wasSentToday(new Date("2026-03-17T23:59:59+09:00"), now)).toBe(false);
  });

  it("returns dispatch decisions for due and duplicate cases", () => {
    expect(
      getDispatchDecision({
        nextScheduledAt: new Date("2026-03-18T00:00:00+09:00"),
        latestSentAt: null,
        now,
      }),
    ).toEqual({ shouldSend: true });

    expect(
      getDispatchDecision({
        nextScheduledAt: new Date("2026-03-19T00:00:00+09:00"),
        latestSentAt: null,
        now,
      }),
    ).toEqual({ shouldSend: false, reason: "not_due_today" });

    expect(
      getDispatchDecision({
        nextScheduledAt: new Date("2026-03-18T00:00:00+09:00"),
        latestSentAt: new Date("2026-03-18T09:00:00+09:00"),
        now,
      }),
    ).toEqual({ shouldSend: false, reason: "already_sent_today" });

    expect(
      getDispatchDecision({
        nextScheduledAt: new Date("2026-03-19T00:00:00+09:00"),
        latestSentAt: new Date("2026-03-18T09:00:00+09:00"),
        now,
        force: true,
      }),
    ).toEqual({ shouldSend: true });
  });

  it("builds debug info with JST comparisons", () => {
    const debugInfo = buildDispatchDecisionDebugInfo({
      itemId: 4,
      questionNumber: 4,
      autoSendEnabled: true,
      status: "PENDING",
      nextScheduledAt: new Date("2026-03-18T12:00:00+09:00"),
      latestSentAt: new Date("2026-03-17T09:00:00+09:00"),
      now,
    });

    expect(debugInfo.now.utc).toBe(now.toISOString());
    expect(debugInfo.todayStart.utc).toBe("2026-03-17T15:00:00.000Z");
    expect(debugInfo.dispatchCheckpoint.utc).toBe("2026-03-18T03:00:00.000Z");
    expect(debugInfo.comparisons.nextScheduledAtLteDispatchCheckpoint).toBe(true);
    expect(debugInfo.comparisons.jst.nextScheduledAtLteDispatchCheckpoint).toContain("=> true");
  });

  it("resolves fallback line user ids and skip messages", () => {
    expect(resolveLineTargetUserId("U_item", "U_default")).toBe("U_item");
    expect(resolveLineTargetUserId(null, "U_default")).toBe("U_default");
    expect(resolveLineTargetUserId(null, null)).toBeNull();

    expect(getDispatchSkipMessage("already_sent_today")).toContain("送信済み");
    expect(getDispatchSkipMessage("not_due_today")).toContain("送信対象");
  });

  it("prioritizes recently solved items before older ones", () => {
    const sorted = sortDispatchCandidates([
      {
        questionNumber: 1,
        nextScheduledAt: new Date("2026-03-19T12:00:00+09:00"),
        latestSentAt: null,
        latestSolvedAt: null,
      },
      {
        questionNumber: 2,
        nextScheduledAt: new Date("2026-03-20T12:00:00+09:00"),
        latestSentAt: new Date("2026-03-18T12:00:00+09:00"),
        latestSolvedAt: new Date("2026-03-20T11:00:00+09:00"),
      },
      {
        questionNumber: 3,
        nextScheduledAt: new Date("2026-03-18T12:00:00+09:00"),
        latestSentAt: new Date("2026-03-18T12:00:00+09:00"),
        latestSolvedAt: new Date("2026-03-20T10:00:00+09:00"),
      },
    ]);

    expect(sorted.map((item) => item.questionNumber)).toEqual([2, 3, 1]);
  });

  it("prioritizes unanswered carry-over items for the next auto dispatch", () => {
    const sorted = sortDispatchCandidates([
      {
        questionNumber: 10,
        nextScheduledAt: new Date("2026-03-19T12:00:00+09:00"),
        latestSentAt: null,
        latestSolvedAt: new Date("2026-03-19T11:00:00+09:00"),
      },
      {
        questionNumber: 11,
        nextScheduledAt: new Date("2026-03-19T12:00:00+09:00"),
        latestSentAt: new Date("2026-03-18T12:00:00+09:00"),
        latestSolvedAt: null,
      },
      {
        questionNumber: 12,
        nextScheduledAt: new Date("2026-03-19T12:00:00+09:00"),
        latestSentAt: new Date("2026-03-18T12:00:00+09:00"),
        latestSolvedAt: new Date("2026-03-17T12:00:00+09:00"),
      },
    ]);

    expect(sorted.map((item) => item.questionNumber)).toEqual([11, 12, 10]);
  });
});
