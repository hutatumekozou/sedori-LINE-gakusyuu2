import "dotenv/config";

import { assertReachableImageMessages } from "@/lib/line/message-delivery";
import { buildQuestionPushMessages } from "@/lib/line/message-builder";
import { getPublicAppUrl } from "@/lib/env";
import { buildQuestionMessage } from "@/lib/study/messages";
import { getDueItemsForDispatch } from "@/lib/study/service";

async function main() {
  const items = await getDueItemsForDispatch();
  const appBaseUrl = getPublicAppUrl();

  console.info("送信前チェックを開始しました。");
  console.info(`送信対象件数: ${items.length}`);
  console.info(`APP_BASE_URL: ${appBaseUrl}`);

  const results: Array<{ itemId: number; questionNumber: number; status: "ready" | "failed"; reason?: string }> = [];

  for (const item of items) {
    try {
      const messages =
        item.images.length > 0
          ? buildQuestionPushMessages(item, appBaseUrl)
          : [
              {
                type: "text" as const,
                text: buildQuestionMessage(item),
              },
            ];

      await assertReachableImageMessages(messages);

      results.push({
        itemId: item.id,
        questionNumber: item.questionNumber,
        status: "ready",
      });
    } catch (error) {
      results.push({
        itemId: item.id,
        questionNumber: item.questionNumber,
        status: "failed",
        reason: error instanceof Error ? error.message : "送信前チェックに失敗しました。",
      });
    }
  }

  console.table(results);

  if (results.some((result) => result.status === "failed")) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("送信前チェックに失敗しました。", error);
  process.exitCode = 1;
});
