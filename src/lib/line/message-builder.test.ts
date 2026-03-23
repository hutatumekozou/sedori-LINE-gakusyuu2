import { describe, expect, it } from "vitest";

import { buildAnswerReplyMessages, buildQuestionPushMessages } from "@/lib/line/message-builder";

describe("buildQuestionPushMessages", () => {
  it("builds text-only message when no images exist", () => {
    const messages = buildQuestionPushMessages(
      {
        questionNumber: 3,
        question: "テスト問題です。",
        images: [],
      },
      "https://example.ngrok-free.app",
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      type: "text",
    });
  });

  it("builds ordered image messages before the text message", () => {
    const messages = buildQuestionPushMessages(
      {
        questionNumber: 3,
        question: "テスト問題です。",
        images: [
          { imagePath: "2026/03/b.jpg", sortOrder: 1 },
          { imagePath: "2026/03/a.jpg", sortOrder: 0 },
        ],
      },
      "https://example.ngrok-free.app",
    );

    expect(messages).toHaveLength(3);
    expect(messages[0]).toMatchObject({
      type: "image",
      originalContentUrl:
        "https://example.ngrok-free.app/api/uploads/2026/03/a.jpg?variant=line-original",
      previewImageUrl:
        "https://example.ngrok-free.app/api/uploads/2026/03/a.jpg?variant=line-preview",
    });
    expect(messages[1]).toMatchObject({
      type: "image",
    });
    expect(messages[2]).toMatchObject({
      type: "text",
    });
  });
});

describe("buildAnswerReplyMessages", () => {
  it("builds ordered answer images before the text message", () => {
    const messages = buildAnswerReplyMessages(
      {
        questionNumber: 7,
        answer: "正解です。",
        answerImages: [
          { imagePath: "2026/03/c.jpg", sortOrder: 1 },
          { imagePath: "2026/03/b.jpg", sortOrder: 0 },
        ],
      },
      "https://example.ngrok-free.app",
    );

    expect(messages).toHaveLength(3);
    expect(messages[0]).toMatchObject({
      type: "image",
      originalContentUrl:
        "https://example.ngrok-free.app/api/uploads/2026/03/b.jpg?variant=line-original",
      previewImageUrl:
        "https://example.ngrok-free.app/api/uploads/2026/03/b.jpg?variant=line-preview",
    });
    expect(messages[2]).toMatchObject({
      type: "text",
      text: expect.stringContaining("【解答】"),
    });
  });
});
