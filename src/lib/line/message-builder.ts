import { getUploadPublicUrl } from "@/lib/storage/local";
import { buildQuestionMessage } from "@/lib/study/messages";

export type LineImageMessage = {
  type: "image";
  originalContentUrl: string;
  previewImageUrl: string;
};

export type LineTextMessage = {
  type: "text";
  text: string;
};

export type LinePushMessage = LineImageMessage | LineTextMessage;

type DispatchImage = {
  imagePath: string;
  sortOrder: number;
};

type QuestionDispatchItem = {
  questionNumber: number;
  question: string;
  images: DispatchImage[];
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
  ] satisfies LinePushMessage[];
}
