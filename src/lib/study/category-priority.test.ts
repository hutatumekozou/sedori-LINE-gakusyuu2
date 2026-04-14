import { describe, expect, it } from "vitest";

import { sortWeakCategoryCandidates } from "@/lib/study/category-priority";

describe("sortWeakCategoryCandidates", () => {
  it("prioritizes low accuracy, then low correct count, then older study date, then favorite", () => {
    const items = sortWeakCategoryCandidates([
      {
        questionNumber: 5,
        isFavorite: false,
        reviewLogs: [
          { actionType: "CORRECT", actionAt: new Date("2026-04-07T12:00:00+09:00") },
          { actionType: "INCORRECT", actionAt: new Date("2026-04-06T12:00:00+09:00") },
        ],
      },
      {
        questionNumber: 2,
        isFavorite: false,
        reviewLogs: [
          { actionType: "INCORRECT", actionAt: new Date("2026-04-02T12:00:00+09:00") },
        ],
      },
      {
        questionNumber: 3,
        isFavorite: false,
        reviewLogs: [
          { actionType: "INCORRECT", actionAt: new Date("2026-04-01T12:00:00+09:00") },
        ],
      },
      {
        questionNumber: 1,
        isFavorite: true,
        reviewLogs: [
          { actionType: "INCORRECT", actionAt: new Date("2026-04-01T12:00:00+09:00") },
        ],
      },
      {
        questionNumber: 4,
        isFavorite: false,
        reviewLogs: [],
      },
    ]);

    expect(items.map((item) => item.questionNumber)).toEqual([4, 1, 3, 2, 5]);
  });
});
