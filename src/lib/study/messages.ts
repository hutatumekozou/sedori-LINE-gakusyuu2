import { formatInTimeZone } from "date-fns-tz";

import { getAppSettings } from "@/lib/env";

type StudyMessageItem = {
  questionNumber: number;
  question: string;
  answer: string;
};

function formatQuestionSentAt(date: Date | string = new Date()) {
  return formatInTimeZone(date, getAppSettings().appTimeZone, "M/d HH:mm");
}

export function buildQuestionMessage(
  item: Pick<StudyMessageItem, "questionNumber" | "question">,
  sentAt: Date | string = new Date(),
) {
  return `${formatQuestionSentAt(sentAt)} 問題番号: ${item.questionNumber}
【今日の復習問題】
${item.question}

返信方法:
- 「解答」→ 解答を表示
- 「正解」→ 正解として記録
- 「不正解」→ 明日もう一度出題
- 「手動」→ この問題を手動送信に切り替え`;
}

export function buildAnswerMessage(item: Pick<StudyMessageItem, "questionNumber" | "answer">) {
  return `問題番号: ${item.questionNumber}
【解答】
${item.answer}

自己判定して返信してください。
- 「正解」
- 「不正解」
- 「手動」`;
}

export function buildCorrectReplyMessage() {
  return "正解として記録しました。次回は7日後に送信します。";
}

export function buildIncorrectReplyMessage() {
  return "不正解として記録しました。明日もう一度送信します。";
}

export function buildManualModeReplyMessage() {
  return "この問題を手動送信に切り替えました。今後の自動送信は停止します。必要なときは管理画面から手動送信してください。";
}

export function buildBatchDispatchSummaryMessage(questionNumbers: number[]) {
  return `【本日の一斉送信】
送信件数: ${questionNumbers.length}件
問題番号: ${questionNumbers.join("、")}`;
}

export function buildNoActiveQuestionMessage() {
  return "現在、返信対象の問題はありません。次の出題を待つか、管理画面から今すぐ送信を実行してください。";
}

export function buildAnswerFirstMessage() {
  return "先に「解答」と送って解答を確認してください。";
}

export function buildReplyToQuestionMessage() {
  return "問題メッセージにリプで「解答」と送ってください。";
}

export function buildReplyToAnswerMessage() {
  return "解答メッセージにリプで「正解」または「不正解」と送ってください。";
}

export function buildReplyToManualTargetMessage() {
  return "切り替えたい問題または解答メッセージにリプで「手動」と送ってください。";
}

export function buildLineHelpMessage() {
  return "受付可能な返信は「解答」「正解」「不正解」「手動」です。";
}
