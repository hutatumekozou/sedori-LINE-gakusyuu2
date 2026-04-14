import "dotenv/config";

import { startDiscordBot } from "@/lib/discord/bot";

startDiscordBot().catch((error) => {
  console.error("Discord bot の起動に失敗しました。", error);
  process.exitCode = 1;
});
