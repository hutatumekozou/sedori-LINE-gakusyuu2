import { formatInTimeZone } from "date-fns-tz";

import { getAppSettings } from "@/lib/env";

type StudyMessageItem = {
  questionNumber: number;
  question: string;
  answer: string;
  productName?: string | null;
  previousSentAt?: Date | string | null;
  previousReviewResult?: string | null;
};

function formatQuestionSentAt(date: Date | string = new Date()) {
  return formatInTimeZone(date, getAppSettings().appTimeZone, "M/d");
}

export function buildQuestionLabel(
  item: Pick<StudyMessageItem, "questionNumber" | "productName">,
  options?: {
    sentAt?: Date | string;
    includeSentAt?: boolean;
  },
) {
  const includeSentAt = options?.includeSentAt ?? true;
  const productName = item.productName?.trim();
  const prefix = includeSentAt ? `${formatQuestionSentAt(options?.sentAt)}問題番号:${item.questionNumber}` : `問題番号:${item.questionNumber}`;

  return productName ? `${prefix} ${productName}` : prefix;
}

export function buildQuestionMessage(
  item: Pick<
    StudyMessageItem,
    "questionNumber" | "question" | "productName" | "previousSentAt" | "previousReviewResult"
  >,
  sentAt: Date | string = new Date(),
) {
  return `${buildQuestionLabel(item, { sentAt })}
前回送信日: ${item.previousSentAt ? formatQuestionSentAt(item.previousSentAt) : "-"} / 前回の正誤: ${item.previousReviewResult || "未回答"}
【今日の復習問題】
${item.question}

返信方法:
- 「解答」→ 解答を表示
- 「超正解」→ 30日後に再出題
- 「大正解」→ 14日後に再出題
- 「正解」→ 正解として記録
- 「不正解」→ 明日もう一度出題
- 「手動」→ この問題を手動送信に切り替え`;
}

export function buildDiscordQuestionMessage(
  item: Pick<
    StudyMessageItem,
    "questionNumber" | "question" | "productName" | "previousSentAt" | "previousReviewResult"
  >,
  sentAt: Date | string = new Date(),
) {
  return `${buildQuestionLabel(item, { sentAt })}
前回送信日: ${item.previousSentAt ? formatQuestionSentAt(item.previousSentAt) : "-"} / 前回の正誤: ${item.previousReviewResult || "未回答"}
【今日の復習問題】
${item.question}

返信方法:
- 「超正解${item.questionNumber}」→ 30日後に再出題
- 「大正解${item.questionNumber}」→ 14日後に再出題
- 「解答${item.questionNumber}」→ 解答を表示
- 「正解${item.questionNumber}」→ 正解として記録
- 「不正解${item.questionNumber}」→ 明日もう一度出題
- 「手動${item.questionNumber}」→ この問題を手動送信に切り替え`;
}

export function buildAnswerMessage(item: Pick<StudyMessageItem, "questionNumber" | "answer">) {
  return `問題番号: ${item.questionNumber}
【解答】
${item.answer}

自己判定して返信してください。
- 「超正解」
- 「大正解」
- 「正解」
- 「不正解」
- 「手動」`;
}

export function buildDiscordAnswerMessage(item: Pick<StudyMessageItem, "questionNumber" | "answer">) {
  return `問題番号: ${item.questionNumber}
【解答】
${item.answer}

自己判定して返信してください。
- 「超正解${item.questionNumber}」
- 「大正解${item.questionNumber}」
- 「正解${item.questionNumber}」
- 「不正解${item.questionNumber}」
- 「手動${item.questionNumber}」`;
}

export function buildSuperCorrectReplyMessage() {
  return "超正解として記録しました。次回は30日後に送信します。";
}

export function buildGreatCorrectReplyMessage() {
  return "大正解として記録しました。次回は14日後に送信します。";
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

export function buildBatchDispatchSummaryMessage(
  questionNumbers: number[],
  sentAt: Date | string = new Date(),
) {
  const datedQuestionNumbers = questionNumbers.map(
    (questionNumber) => `${formatQuestionSentAt(sentAt)}問題番号: ${questionNumber}`,
  );

  return `【今 送信した問題一覧】
送信件数: ${questionNumbers.length}件
問題番号:
${datedQuestionNumbers.join("\n")}`;
}

export function buildNoActiveQuestionMessage() {
  return "現在、返信対象の問題はありません。次の出題を待つか、管理画面から今すぐ送信を実行してください。";
}

export function buildAnswerFirstMessage() {
  return "先に「解答」と送って解答を確認してください。";
}

export function buildReplyToQuestionMessage() {
  return "問題メッセージに返信で「解答」と送ってください。";
}

export function buildReplyToAnswerMessage() {
  return "解答メッセージに返信で「超正解」「大正解」「正解」または「不正解」と送ってください。";
}

export function buildAnswerImageFallbackMessage() {
  return "解答画像を取得できなかったため、今回はテキストのみ表示します。";
}

export function buildReplyToManualTargetMessage() {
  return "切り替えたい問題または解答メッセージに返信で「手動」と送ってください。";
}

export function buildCategoryDispatchStartMessage(category: string, count: number) {
  return `「${category}」の苦手問題を${count}問送ります。`;
}

export function buildEmptyCategoryDispatchMessage(category: string) {
  return `「${category}」に該当する問題がまだありません。`;
}

export function buildLineHelpMessage() {
  return "受付可能な返信は「解答」「超正解」「大正解」「正解」「不正解」「手動」です。カテゴリ名を送るとそのカテゴリの苦手問題を最大5問、ブランド名を送るとそのブランドの苦手問題を最大10問出題します。";
}

export function buildDiscordHelpMessage() {
  return "受付可能な返信は「解答87」「超正解87」「大正解87」「正解87」「不正解87」「手動87」のように問題番号付きです。カテゴリ名を送るとそのカテゴリの苦手問題を最大5問、ブランド名を送るとそのブランドの苦手問題を最大10問このチャンネルへ送ります。";
}
