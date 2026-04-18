import "dotenv/config";

import { getDefaultDiscordUserId, getDiscordBotConfig, getDiscordStudyChannelId } from "@/lib/env";
import { readStoredImage } from "@/lib/storage/local";
import { resolveChatTargetUserId } from "@/lib/study/dispatch-rules";
import { getDueItemsForDispatch } from "@/lib/study/service";

type ReadinessResult = {
  itemId: number;
  questionNumber: number;
  status: "ready" | "failed";
  reason?: string;
};

async function assertDiscordBotToken() {
  const { botToken } = getDiscordBotConfig();
  const response = await fetch("https://discord.com/api/v10/users/@me", {
    headers: {
      Authorization: `Bot ${botToken}`,
    },
    cache: "no-store",
  });

  if (response.ok) {
    return;
  }

  const bodyText = await response.text();

  throw new Error(
    bodyText
      ? `Discord bot token の確認に失敗しました。${bodyText}`
      : `Discord bot token の確認に失敗しました。status=${response.status}`,
  );
}

async function assertReadableQuestionImages(imagePaths: string[]) {
  await Promise.all(imagePaths.map((imagePath) => readStoredImage(imagePath)));
}

async function main() {
  const items = await getDueItemsForDispatch();
  const defaultDiscordUserId = getDefaultDiscordUserId();
  const studyChannelId = getDiscordStudyChannelId();

  console.info("ローカル自動送信チェックを開始しました。");
  console.info(`送信対象件数: ${items.length}`);
  console.info(`DISCORD_DEFAULT_USER_ID: ${defaultDiscordUserId || "<unset>"}`);
  console.info(`DISCORD_STUDY_CHANNEL_ID: ${studyChannelId || "<unset>"}`);

  await assertDiscordBotToken();
  console.info("Discord bot token: ok");

  const results: ReadinessResult[] = [];

  for (const item of items) {
    try {
      const discordUserId = resolveChatTargetUserId(item.user.discordUserId, defaultDiscordUserId);

      if (!discordUserId) {
        throw new Error(
          "送信先の Discord userId が未設定です。DISCORD_DEFAULT_USER_ID を設定するか、対象ユーザーに discordUserId を紐付けてください。",
        );
      }

      await assertReadableQuestionImages(item.images.map((image) => image.imagePath));

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
        reason: error instanceof Error ? error.message : "ローカル自動送信チェックに失敗しました。",
      });
    }
  }

  console.table(results);

  if (results.some((result) => result.status === "failed")) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("ローカル自動送信チェックに失敗しました。", error);
  process.exitCode = 1;
});
