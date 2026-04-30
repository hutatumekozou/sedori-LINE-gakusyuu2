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
  previousSentAt?: Date | string | null;
  previousReviewResult?: string | null;
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
  text?: string;
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

function combineFirstImageWithText(
  imageMessages: DiscordAttachmentMessage[],
  text: string,
) {
  if (imageMessages.length === 0) {
    return [
      {
        type: "text" as const,
        text,
      },
    ] satisfies DiscordDmMessage[];
  }

  const [firstImage, ...remainingImages] = imageMessages;

  return [
    {
      ...firstImage,
      text,
    },
    ...remainingImages,
  ] satisfies DiscordDmMessage[];
}

export function buildQuestionDmMessages(item: QuestionDispatchItem) {
  const imageMessages = item.images
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .slice(0, 4)
    .map((image) => buildAttachmentMessage(image.imagePath));

  return combineFirstImageWithText(imageMessages, buildDiscordQuestionMessage(item));
}

export function buildAnswerDmMessages(item: AnswerDispatchItem) {
  const imageMessages = item.answerImages
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .slice(0, 4)
    .map((image) => buildAttachmentMessage(image.imagePath));

  return combineFirstImageWithText(imageMessages, buildDiscordAnswerMessage(item));
}
