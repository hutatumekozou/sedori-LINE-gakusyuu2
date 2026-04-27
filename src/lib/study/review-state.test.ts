import { describe, expect, it } from "vitest";

import { formatDateInputValue } from "@/lib/date";
import {
  calculateNextScheduledAtFromResult,
  canJudgeAnswer,
  canShowAnswer,
  getConversationStateAfterAnswerShown,
  getConversationStateAfterQuestionSent,
  getConversationStateAfterReviewResult,
  getItemStatusAfterAnswerShown,
  getItemStatusAfterReviewResult,
  getLastResultFromLogs,
  normalizeLineCommand,
} from "@/lib/study/review-state";
import {
  buildAnswerMessage,
  buildBatchDispatchSummaryMessage,
  buildCategoryDispatchStartMessage,
  buildDiscordHelpMessage,
  buildEmptyCategoryDispatchMessage,
  buildLineHelpMessage,
  buildQuestionLabel,
  buildQuestionMessage,
} from "@/lib/study/messages";

describe("review-state", () => {
  it("normalizes LINE commands", () => {
    expect(normalizeLineCommand(" 解答 ")).toBe("answer");
    expect(normalizeLineCommand("大正解")).toBe("greatCorrect");
    expect(normalizeLineCommand("正解")).toBe("correct");
    expect(normalizeLineCommand("不正解")).toBe("incorrect");
    expect(normalizeLineCommand("手動")).toBe("manual");
    expect(normalizeLineCommand("こんにちは")).toBe("unknown");
  });

  it("calculates next schedule based on result", () => {
    const baseDate = new Date("2026-03-18T12:00:00+09:00");

    expect(formatDateInputValue(calculateNextScheduledAtFromResult("correct", baseDate))).toBe(
      "2026-03-25",
    );
    expect(
      formatDateInputValue(calculateNextScheduledAtFromResult("greatCorrect", baseDate)),
    ).toBe("2026-04-01");
    expect(
      formatDateInputValue(calculateNextScheduledAtFromResult("incorrect", baseDate)),
    ).toBe("2026-03-19");
  });

  it("checks conversation states safely", () => {
    expect(canShowAnswer("QUESTION_SENT")).toBe(true);
    expect(canShowAnswer("ANSWER_SHOWN")).toBe(true);
    expect(canShowAnswer(null)).toBe(false);

    expect(canJudgeAnswer("ANSWER_SHOWN")).toBe(true);
    expect(canJudgeAnswer("QUESTION_SENT")).toBe(false);

    expect(getConversationStateAfterQuestionSent()).toBe("QUESTION_SENT");
    expect(getConversationStateAfterAnswerShown("QUESTION_SENT")).toBe("ANSWER_SHOWN");
    expect(getConversationStateAfterAnswerShown(null)).toBeNull();
    expect(getConversationStateAfterReviewResult()).toBeNull();

    expect(getItemStatusAfterAnswerShown()).toBe("ANSWER_SHOWN");
    expect(getItemStatusAfterReviewResult("greatCorrect")).toBe("CORRECT");
    expect(getItemStatusAfterReviewResult("correct")).toBe("CORRECT");
    expect(getItemStatusAfterReviewResult("incorrect")).toBe("INCORRECT");
  });

  it("finds the latest result from review logs", () => {
    expect(
      getLastResultFromLogs([
        { actionType: "SENT" },
        { actionType: "ANSWER_SHOWN" },
        { actionType: "GREAT_CORRECT" },
      ]),
    ).toBe("correct");

    expect(
      getLastResultFromLogs([
        { actionType: "SENT" },
        { actionType: "ANSWER_SHOWN" },
        { actionType: "INCORRECT" },
      ]),
    ).toBe("incorrect");

    expect(
      getLastResultFromLogs([
        { actionType: "SENT" },
        { actionType: "ANSWER_SHOWN" },
      ]),
    ).toBe("unanswered");
  });
});

describe("study messages", () => {
  const item = {
    questionNumber: 12,
    productName: "BIRDWELL ボードショーツ",
    question: "売れた理由を説明してください。",
    answer: "付属品が揃っており、状態が良かったためです。",
    explanation: "安心材料が揃うと購入判断が早くなります。",
  };

  it("builds question and answer messages", () => {
    expect(buildQuestionLabel(item, { sentAt: "2026-03-31T12:00:00+09:00" })).toBe(
      "3/31問題番号:12 BIRDWELL ボードショーツ",
    );
    expect(buildQuestionLabel(item, { includeSentAt: false })).toBe(
      "問題番号:12 BIRDWELL ボードショーツ",
    );
    expect(buildQuestionMessage(item, "2026-03-31T12:00:00+09:00")).toContain(
      "3/31問題番号:12 BIRDWELL ボードショーツ",
    );
    expect(buildQuestionMessage(item)).toContain("解答");
    expect(buildQuestionMessage(item)).toContain("手動");

    expect(buildAnswerMessage(item)).toContain("【解答】");
    expect(buildAnswerMessage(item)).toContain(item.answer);
    expect(buildAnswerMessage(item)).toContain("大正解");
    expect(buildAnswerMessage(item)).toContain("手動");
    expect(buildAnswerMessage(item)).not.toContain("【解説】");
    expect(buildCategoryDispatchStartMessage("メンズアパレル", 5)).toBe(
      "「メンズアパレル」の苦手問題を5問送ります。",
    );
    expect(buildEmptyCategoryDispatchMessage("メンズアパレル")).toBe(
      "「メンズアパレル」に該当する問題がまだありません。",
    );
    expect(buildLineHelpMessage()).toContain("カテゴリ名");
    expect(buildLineHelpMessage()).toContain("ブランド名");
    expect(buildLineHelpMessage()).toContain("最大10問");
    expect(buildDiscordHelpMessage()).toContain("ブランド名");
    expect(buildDiscordHelpMessage()).toContain("最大10問");
  });

  it("builds batch dispatch summary messages with dates", () => {
    const message = buildBatchDispatchSummaryMessage([9, 23, 21], "2026-03-31T12:00:00+09:00");

    expect(message).toContain("【今 送信した問題一覧】");
    expect(message).toContain("送信件数: 3件");
    expect(message).toContain("問題番号:\n3/31問題番号: 9\n3/31問題番号: 23\n3/31問題番号: 21");
  });
});
