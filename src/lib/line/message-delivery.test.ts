import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { assertReachableImageMessages } from "@/lib/line/message-delivery";
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
});
