import path from "node:path";

import { getMimeTypeFromPath } from "@/lib/storage/local";
import { buildDiscordAnswerMessage, buildDiscordQuestionMessage } from "@/lib/study/messages";
import { fromBlobImagePath, isBlobImagePath } from "@/lib/study/image-upload";

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

export type DiscordAttachmentMessage = {
  type: "attachment";
  imagePath: string;
  fileName: string;
  contentType: string;
};

export type DiscordTextMessage = {
  type: "text";
  text: string;
};

export type DiscordDmMessage = DiscordAttachmentMessage | DiscordTextMessage;

function buildAttachmentMessage(imagePath: string): DiscordAttachmentMessage {
  const normalizedPath = isBlobImagePath(imagePath) ? fromBlobImagePath(imagePath) : imagePath;

  return {
    type: "attachment",
    imagePath,
    fileName: path.posix.basename(normalizedPath),
    contentType: getMimeTypeFromPath(imagePath),
  };
}

export function buildQuestionDmMessages(item: QuestionDispatchItem) {
  const imageMessages = item.images
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .slice(0, 4)
    .map((image) => buildAttachmentMessage(image.imagePath));

  return [
    ...imageMessages,
    {
      type: "text" as const,
      text: buildDiscordQuestionMessage(item),
    },
  ] satisfies DiscordDmMessage[];
}

export function buildAnswerDmMessages(item: AnswerDispatchItem) {
  const imageMessages = item.answerImages
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .slice(0, 4)
    .map((image) => buildAttachmentMessage(image.imagePath));

  return [
    ...imageMessages,
    {
      type: "text" as const,
      text: buildDiscordAnswerMessage(item),
    },
  ] satisfies DiscordDmMessage[];
}
