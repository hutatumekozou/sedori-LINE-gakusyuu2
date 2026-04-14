import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertReachableImageMessages,
  getMessagesWithImageFallback,
  getReplyMessagesWithImageFallback,
} from "@/lib/line/message-delivery";
import type { LineMessage } from "@/lib/line/message-builder";

describe("assertReachableImageMessages", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("skips checks for text-only messages", async () => {
    await expect(
      assertReachableImageMessages([
        {
          type: "text",
          text: "問題文",
        },
      ]),
    ).resolves.toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts reachable image URLs", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: {
          "content-type": "image/jpeg",
        },
      }),
    );

    const messages: LineMessage[] = [
      {
        type: "image",
        originalContentUrl: "https://example.ngrok-free.app/api/uploads/a.jpg?variant=line-original",
        previewImageUrl: "https://example.ngrok-free.app/api/uploads/a.jpg?variant=line-preview",
      },
      {
        type: "text",
        text: "問題文",
      },
    ];

    await expect(assertReachableImageMessages(messages)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects unreachable image URLs", async () => {
    fetchMock.mockRejectedValue(new Error("network error"));

    await expect(
      assertReachableImageMessages([
        {
          type: "image",
          originalContentUrl: "https://example.ngrok-free.app/api/uploads/a.jpg?variant=line-original",
          previewImageUrl: "https://example.ngrok-free.app/api/uploads/a.jpg?variant=line-preview",
        },
      ]),
    ).rejects.toThrow("LINE画像の取得確認に失敗しました");
  });

  it("rejects non-image responses", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
      }),
    );

    await expect(
      assertReachableImageMessages([
        {
          type: "image",
          originalContentUrl: "https://example.ngrok-free.app/api/uploads/a.jpg?variant=line-original",
          previewImageUrl: "https://example.ngrok-free.app/api/uploads/a.jpg?variant=line-preview",
        },
      ]),
    ).rejects.toThrow("LINE画像の取得確認に失敗しました");
  });

  it("falls back to text-only reply messages when images are unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("network error"));

    const result = await getReplyMessagesWithImageFallback([
      {
        type: "image",
        originalContentUrl: "https://example.ngrok-free.app/api/uploads/a.jpg?variant=line-original",
        previewImageUrl: "https://example.ngrok-free.app/api/uploads/a.jpg?variant=line-preview",
      },
      {
        type: "text",
        text: "【解答】正解です。",
      },
    ]);

    expect(result.fellBackToTextOnly).toBe(true);
    expect(result.messages).toEqual([
      {
        type: "text",
        text: "【解答】正解です。",
      },
    ]);
  });

  it("falls back to text-only push messages when images are unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("network error"));

    const result = await getMessagesWithImageFallback([
      {
        type: "image",
        originalContentUrl: "https://example.ngrok-free.app/api/uploads/a.jpg?variant=line-original",
        previewImageUrl: "https://example.ngrok-free.app/api/uploads/a.jpg?variant=line-preview",
      },
      {
        type: "text",
        text: "【問題】これはいくらで売れた？",
      },
    ]);

    expect(result.fellBackToTextOnly).toBe(true);
    expect(result.messages).toEqual([
      {
        type: "text",
        text: "【問題】これはいくらで売れた？",
      },
    ]);
  });

  it("keeps original reply messages when image URLs are reachable", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: {
          "content-type": "image/jpeg",
        },
      }),
    );

    const messages: LineMessage[] = [
      {
        type: "image",
        originalContentUrl: "https://example.ngrok-free.app/api/uploads/a.jpg?variant=line-original",
        previewImageUrl: "https://example.ngrok-free.app/api/uploads/a.jpg?variant=line-preview",
      },
      {
        type: "text",
        text: "【解答】正解です。",
      },
    ];

    const result = await getReplyMessagesWithImageFallback(messages);

    expect(result.fellBackToTextOnly).toBe(false);
    expect(result.messages).toEqual(messages);
  });
});
