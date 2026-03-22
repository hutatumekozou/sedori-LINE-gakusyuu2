import type { LinePushMessage } from "@/lib/line/message-builder";

const IMAGE_FETCH_TIMEOUT_MS = 5000;

function buildImageAccessError() {
  return new Error(
    "LINE画像の取得確認に失敗しました。APP_BASE_URL に現在有効な HTTPS 公開URL を設定してください。",
  );
}

async function assertReachableImageUrl(url: string) {
  let response: Response;

  try {
    response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
    });
  } catch {
    throw buildImageAccessError();
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() || "";

  if (!response.ok || !contentType.startsWith("image/")) {
    throw buildImageAccessError();
  }
}

export async function assertReachableImageMessages(messages: LinePushMessage[]) {
  const urls = messages.flatMap((message) =>
    message.type === "image" ? [message.previewImageUrl, message.originalContentUrl] : [],
  );

  await Promise.all(urls.map((url) => assertReachableImageUrl(url)));
}
