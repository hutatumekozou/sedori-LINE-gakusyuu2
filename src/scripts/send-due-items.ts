import "dotenv/config";

import { dispatchStudyItems } from "@/lib/line/service";

async function main() {
  const result = await dispatchStudyItems();

  console.info("送信処理が完了しました。");
  console.table(result.results);

  if (result.failedCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("送信処理に失敗しました。", error);
  process.exitCode = 1;
});
