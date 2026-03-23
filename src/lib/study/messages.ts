type StudyMessageItem = {
  questionNumber: number;
  question: string;
  answer: string;
};

export function buildQuestionMessage(item: Pick<StudyMessageItem, "questionNumber" | "question">) {
  return `問題番号: ${item.questionNumber}
【今日の復習問題】
${item.question}

返信方法:
- 「解答」→ 解答を表示
- 「正解」→ 正解として記録
- 「不正解」→ 明日もう一度出題`;
}

export function buildAnswerMessage(item: Pick<StudyMessageItem, "questionNumber" | "answer">) {
  return `問題番号: ${item.questionNumber}
【解答】
${item.answer}

自己判定して返信してください。
- 「正解」
- 「不正解」`;
}

export function buildCorrectReplyMessage() {
  return "正解として記録しました。次回は7日後に送信します。";
}

export function buildIncorrectReplyMessage() {
  return "不正解として記録しました。明日もう一度送信します。";
}

export function buildNoActiveQuestionMessage() {
  return "現在、返信対象の問題はありません。次の出題を待つか、管理画面から今すぐ送信を実行してください。";
}

export function buildAnswerFirstMessage() {
  return "先に「解答」と送って解答を確認してください。";
}

export function buildLineHelpMessage() {
  return "受付可能な返信は「解答」「正解」「不正解」です。";
}
