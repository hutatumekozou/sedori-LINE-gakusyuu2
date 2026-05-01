import "dotenv/config";

import { dispatchHealthcheckQuestions } from "@/lib/discord/send-due-readiness";

async function main() {
  console.info("11時動作確認問題の送信を開始しました。");

  const result = await dispatchHealthcheckQuestions();

  console.info(result.detail);

  if (!result.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("11時動作確認問題の送信に失敗しました。", error);
  process.exitCode = 1;
});
