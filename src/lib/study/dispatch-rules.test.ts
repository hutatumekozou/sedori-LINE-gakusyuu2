import { describe, expect, it } from "vitest";

import {
  getDispatchDecision,
  getDispatchSkipMessage,
  isDueForDispatch,
  resolveLineTargetUserId,
  wasSentToday,
} from "@/lib/study/dispatch-rules";

describe("dispatch-rules", () => {
  const now = new Date("2026-03-18T12:00:00+09:00");

  it("judges due items on JST correctly", () => {
    expect(isDueForDispatch(new Date("2026-03-18T00:00:00+09:00"), now)).toBe(true);
    expect(isDueForDispatch(new Date("2026-03-18T23:59:59+09:00"), now)).toBe(true);
    expect(isDueForDispatch(new Date("2026-03-19T00:00:00+09:00"), now)).toBe(false);
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

  it("resolves fallback line user ids and skip messages", () => {
    expect(resolveLineTargetUserId("U_item", "U_default")).toBe("U_item");
    expect(resolveLineTargetUserId(null, "U_default")).toBe("U_default");
    expect(resolveLineTargetUserId(null, null)).toBeNull();

    expect(getDispatchSkipMessage("already_sent_today")).toContain("送信済み");
    expect(getDispatchSkipMessage("not_due_today")).toContain("送信対象");
  });
});
