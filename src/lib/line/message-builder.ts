import { getUploadPublicUrl } from "@/lib/storage/local";
import { buildAnswerMessage, buildQuestionMessage } from "@/lib/study/messages";

export type LineImageMessage = {
  type: "image";
  originalContentUrl: string;
  previewImageUrl: string;
};

export type LineTextMessage = {
  type: "text";
  text: string;
};

export type LineMessage = LineImageMessage | LineTextMessage;

type DispatchImage = {
  imagePath: string;
  sortOrder: number;
};

type QuestionDispatchItem = {
  questionNumber: number;
  productName?: string | null;
  question: string;
  images: DispatchImage[];
};

type AnswerDispatchItem = {
  questionNumber: number;
  answer: string;
  answerImages: DispatchImage[];
};

function buildAbsoluteUploadUrl(appBaseUrl: string, imagePath: string, variant: "line-original" | "line-preview") {
  const url = new URL(getUploadPublicUrl(imagePath), `${appBaseUrl}/`);
  url.searchParams.set("variant", variant);
  return url.toString();
}

export function buildQuestionPushMessages(item: QuestionDispatchItem, appBaseUrl: string) {
  const imageMessages = item.images
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .slice(0, 4)
    .map((image): LineImageMessage => ({
      type: "image" as const,
      originalContentUrl: buildAbsoluteUploadUrl(appBaseUrl, image.imagePath, "line-original"),
      previewImageUrl: buildAbsoluteUploadUrl(appBaseUrl, image.imagePath, "line-preview"),
    }));

  return [
    ...imageMessages,
    {
      type: "text" as const,
      text: buildQuestionMessage(item),
    },
  ] satisfies LineMessage[];
}

export function buildAnswerReplyMessages(
  item: AnswerDispatchItem,
  appBaseUrl: string,
) {
  const imageMessages = item.answerImages
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .slice(0, 4)
    .map((image): LineImageMessage => ({
      type: "image" as const,
      originalContentUrl: buildAbsoluteUploadUrl(appBaseUrl, image.imagePath, "line-original"),
      previewImageUrl: buildAbsoluteUploadUrl(appBaseUrl, image.imagePath, "line-preview"),
    }));

  return [
    ...imageMessages,
    {
      type: "text" as const,
      text: buildAnswerMessage(item),
    },
  ] satisfies LineMessage[];
}
