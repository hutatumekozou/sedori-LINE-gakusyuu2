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
import { buildAnswerMessage, buildQuestionMessage } from "@/lib/study/messages";

describe("review-state", () => {
  it("normalizes LINE commands", () => {
    expect(normalizeLineCommand(" 解答 ")).toBe("answer");
    expect(normalizeLineCommand("正解")).toBe("correct");
    expect(normalizeLineCommand("不正解")).toBe("incorrect");
    expect(normalizeLineCommand("こんにちは")).toBe("unknown");
  });

  it("calculates next schedule based on result", () => {
    const baseDate = new Date("2026-03-18T12:00:00+09:00");

    expect(formatDateInputValue(calculateNextScheduledAtFromResult("correct", baseDate))).toBe(
      "2026-03-25",
    );
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
    expect(getItemStatusAfterReviewResult("correct")).toBe("CORRECT");
    expect(getItemStatusAfterReviewResult("incorrect")).toBe("INCORRECT");
  });

  it("finds the latest result from review logs", () => {
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
    question: "売れた理由を説明してください。",
    answer: "付属品が揃っており、状態が良かったためです。",
    explanation: "安心材料が揃うと購入判断が早くなります。",
  };

  it("builds question and answer messages", () => {
    expect(buildQuestionMessage(item)).toContain("問題番号: 12");
    expect(buildQuestionMessage(item)).toContain("解答");

    expect(buildAnswerMessage(item)).toContain("【解答】");
    expect(buildAnswerMessage(item)).toContain(item.answer);
    expect(buildAnswerMessage(item)).not.toContain("【解説】");
  });
});
