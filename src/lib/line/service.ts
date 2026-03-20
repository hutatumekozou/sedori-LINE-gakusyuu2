import { messagingApi, validateSignature } from "@line/bot-sdk";
import { ConversationStateType, ItemStatus, ReviewActionType } from "@/generated/prisma/client";
import { z } from "zod";

import {
  getCronSecret,
  getDefaultLineUserId,
  getLineMessagingConfig,
  getLineWebhookSecret,
} from "@/lib/env";
import { prisma } from "@/lib/prisma";
import {
  getDispatchDecision,
  getDispatchSkipMessage,
  resolveLineTargetUserId,
} from "@/lib/study/dispatch-rules";
import {
  buildAnswerFirstMessage,
  buildAnswerMessage,
  buildCorrectReplyMessage,
  buildIncorrectReplyMessage,
  buildLineHelpMessage,
  buildNoActiveQuestionMessage,
  buildQuestionMessage,
} from "@/lib/study/messages";
import {
  calculateNextScheduledAtFromResult,
  canJudgeAnswer,
  canShowAnswer,
  getConversationStateAfterAnswerShown,
  getConversationStateAfterQuestionSent,
  getItemStatusAfterAnswerShown,
  getItemStatusAfterReviewResult,
  normalizeLineCommand,
} from "@/lib/study/review-state";
import { getDueItemsForDispatch } from "@/lib/study/service";

const lineWebhookSchema = z.object({
  events: z.array(
    z
      .object({
        type: z.string(),
        replyToken: z.string().optional(),
        source: z
          .object({
            userId: z.string().optional(),
          })
          .passthrough()
          .optional(),
        message: z
          .object({
            type: z.string(),
            text: z.string().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough(),
  ),
});

function getLineClient() {
  const config = getLineMessagingConfig();
  return new messagingApi.MessagingApiClient({
    channelAccessToken: config.channelAccessToken,
  });
}

async function replyText(replyToken: string, text: string) {
  const client = getLineClient();
  await client.replyMessage({
    replyToken,
    messages: [
      {
        type: "text",
        text,
      },
    ],
  });
}

async function pushText(to: string, text: string) {
  const client = getLineClient();
  await client.pushMessage({
    to,
    messages: [
      {
        type: "text",
        text,
      },
    ],
  });
}

async function syncLineProfile(lineUserId: string) {
  try {
    const profile = await getLineClient().getProfile(lineUserId);

    return prisma.user.upsert({
      where: {
        lineUserId,
      },
      update: {
        displayName: profile.displayName || undefined,
      },
      create: {
        lineUserId,
        displayName: profile.displayName || undefined,
      },
    });
  } catch (error) {
    console.warn("LINE profile fetch failed. Falling back to local user lookup.", {
      lineUserId,
      error,
    });

    const localUser = await prisma.user.findFirst({
      where: {
        lineUserId: null,
      },
      orderBy: {
        id: "asc",
      },
    });

    if (localUser) {
      return prisma.user.update({
        where: {
          id: localUser.id,
        },
        data: {
          lineUserId,
        },
      });
    }

    const existing = await prisma.user.findUnique({
      where: {
        lineUserId,
      },
    });

    if (existing) {
      return existing;
    }

    return prisma.user.create({
      data: {
        lineUserId,
      },
    });
  }
}

async function handleAnswerRequest(userId: number, replyToken: string) {
  const activeState = await prisma.activeConversationState.findUnique({
    where: {
      userId,
    },
    include: {
      item: true,
    },
  });

  if (!activeState) {
    await replyText(replyToken, buildNoActiveQuestionMessage());
    return;
  }

  if (!canShowAnswer(activeState.state)) {
    await replyText(replyToken, buildAnswerFirstMessage());
    return;
  }

  const message = buildAnswerMessage(activeState.item);

  if (activeState.state === ConversationStateType.ANSWER_SHOWN) {
    await replyText(replyToken, message);
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.productStudyItem.update({
      where: {
        id: activeState.itemId,
      },
      data: {
        status: getItemStatusAfterAnswerShown(),
      },
    });

    await tx.activeConversationState.update({
      where: {
        userId,
      },
      data: {
        state: getConversationStateAfterAnswerShown(activeState.state)!,
      },
    });

    await tx.reviewLog.create({
      data: {
        itemId: activeState.itemId,
        userId,
        actionType: ReviewActionType.ANSWER_SHOWN,
        rawText: "解答",
      },
    });
  });

  await replyText(replyToken, message);
}

async function handleResultRequest(
  userId: number,
  replyToken: string,
  result: "correct" | "incorrect",
  rawText: string,
) {
  const activeState = await prisma.activeConversationState.findUnique({
    where: {
      userId,
    },
  });

  if (!activeState) {
    await replyText(replyToken, buildNoActiveQuestionMessage());
    return;
  }

  if (!canJudgeAnswer(activeState.state)) {
    await replyText(replyToken, buildAnswerFirstMessage());
    return;
  }

  const nextScheduledAt = calculateNextScheduledAtFromResult(result);
  const actionType =
    result === "correct" ? ReviewActionType.CORRECT : ReviewActionType.INCORRECT;
  const status = getItemStatusAfterReviewResult(result);

  await prisma.$transaction(async (tx) => {
    await tx.productStudyItem.update({
      where: {
        id: activeState.itemId,
      },
      data: {
        nextScheduledAt,
        status,
      },
    });

    await tx.reviewLog.create({
      data: {
        itemId: activeState.itemId,
        userId,
        actionType,
        rawText,
      },
    });

    await tx.activeConversationState.delete({
      where: {
        userId,
      },
    });
  });

  await replyText(
    replyToken,
    result === "correct"
      ? buildCorrectReplyMessage()
      : buildIncorrectReplyMessage(),
  );
}

async function handleTextEvent(event: z.infer<typeof lineWebhookSchema>["events"][number]) {
  if (event.type !== "message" || event.message?.type !== "text" || !event.replyToken) {
    return;
  }

  const lineUserId = event.source?.userId;

  if (!lineUserId) {
    await replyText(event.replyToken, "ユーザー情報を取得できませんでした。");
    return;
  }

  const user = await syncLineProfile(lineUserId);
  const command = normalizeLineCommand(event.message.text || "");

  if (command === "answer") {
    await handleAnswerRequest(user.id, event.replyToken);
    return;
  }

  if (command === "correct") {
    await handleResultRequest(user.id, event.replyToken, "correct", event.message.text || "");
    return;
  }

  if (command === "incorrect") {
    await handleResultRequest(user.id, event.replyToken, "incorrect", event.message.text || "");
    return;
  }

  await replyText(event.replyToken, buildLineHelpMessage());
}

export async function handleLineWebhook(rawBody: string, signature: string) {
  const channelSecret = getLineWebhookSecret();

  if (!validateSignature(rawBody, channelSecret, signature)) {
    throw new Error("LINE webhook の署名検証に失敗しました。");
  }

  let parsedBody: unknown;

  try {
    parsedBody = JSON.parse(rawBody);
  } catch (error) {
    console.error("LINE webhook payload parse failed", { error });
    throw new Error("LINE webhook のJSON形式が不正です。");
  }

  const parsed = lineWebhookSchema.parse(parsedBody);

  for (const event of parsed.events) {
    await handleTextEvent(event);
  }
}

export async function dispatchStudyItems(itemIds?: number[], force = false) {
  const items = await getDueItemsForDispatch(itemIds);
  const results: Array<{ itemId: number; status: "sent" | "skipped" | "failed"; reason?: string }> = [];
  const defaultLineUserId = getDefaultLineUserId();

  if (itemIds) {
    const foundIds = new Set(items.map((item) => item.id));
    for (const itemId of itemIds) {
      if (!foundIds.has(itemId)) {
        results.push({
          itemId,
          status: "failed",
          reason: "対象の問題が見つかりませんでした。",
        });
      }
    }
  }

  for (const item of items) {
    const lineUserId = resolveLineTargetUserId(item.user.lineUserId, defaultLineUserId);
    const latestSentLog = item.reviewLogs[0];

    if (!lineUserId) {
      results.push({
        itemId: item.id,
        status: "failed",
        reason:
          "送信先の LINE userId が未設定です。LINE_DEFAULT_USER_ID を設定するか、対象ユーザーに lineUserId を紐付けてください。",
      });
      continue;
    }

    const dispatchDecision = getDispatchDecision({
      nextScheduledAt: item.nextScheduledAt,
      latestSentAt: latestSentLog?.actionAt,
      force,
    });

    if (!dispatchDecision.shouldSend) {
      results.push({
        itemId: item.id,
        status: "skipped",
        reason: getDispatchSkipMessage(dispatchDecision.reason),
      });
      continue;
    }

    try {
      await pushText(lineUserId, buildQuestionMessage(item));

      await prisma.$transaction(async (tx) => {
        await tx.productStudyItem.update({
          where: {
            id: item.id,
          },
          data: {
            status: ItemStatus.QUESTION_SENT,
          },
        });

        await tx.reviewLog.create({
          data: {
            itemId: item.id,
            userId: item.userId,
            actionType: ReviewActionType.SENT,
          },
        });

        await tx.activeConversationState.upsert({
          where: {
            userId: item.userId,
          },
          update: {
            itemId: item.id,
            state: getConversationStateAfterQuestionSent(),
          },
          create: {
            userId: item.userId,
            itemId: item.id,
            state: getConversationStateAfterQuestionSent(),
          },
        });
      });

      results.push({
        itemId: item.id,
        status: "sent",
      });
    } catch (error) {
      results.push({
        itemId: item.id,
        status: "failed",
        reason: error instanceof Error ? error.message : "送信に失敗しました。",
      });
      console.error("LINE push send failed", {
        itemId: item.id,
        questionNumber: item.questionNumber,
        lineUserId,
        error,
      });
    }
  }

  return {
    sentCount: results.filter((result) => result.status === "sent").length,
    skippedCount: results.filter((result) => result.status === "skipped").length,
    failedCount: results.filter((result) => result.status === "failed").length,
    results,
  };
}

export function assertCronSecret(secret: string | null) {
  return secret === getCronSecret();
}
