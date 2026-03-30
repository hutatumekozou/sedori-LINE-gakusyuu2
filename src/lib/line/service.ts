import { messagingApi, validateSignature } from "@line/bot-sdk";
import {
  ConversationStateType,
  ItemStatus,
  LineApiCallKind,
  LineApiCallStatus,
  ReviewActionType,
} from "@/generated/prisma/client";
import { z } from "zod";

import {
  getCronSecret,
  getDefaultLineUserId,
  getLineMessagingConfig,
  getLineWebhookSecret,
  getPublicAppUrl,
} from "@/lib/env";
import { scheduleNextReview } from "@/lib/date";
import { assertReachableImageMessages } from "@/lib/line/message-delivery";
import {
  buildAnswerReplyMessages,
  buildQuestionPushMessages,
  type LineMessage,
} from "@/lib/line/message-builder";
import { prisma } from "@/lib/prisma";
import {
  buildDispatchDecisionDebugInfo,
  getDispatchDecision,
  getDispatchSkipMessage,
  resolveLineTargetUserId,
} from "@/lib/study/dispatch-rules";
import {
  buildAnswerFirstMessage,
  buildBatchDispatchSummaryMessage,
  buildCorrectReplyMessage,
  buildIncorrectReplyMessage,
  buildLineHelpMessage,
  buildManualModeReplyMessage,
  buildNoActiveQuestionMessage,
  buildQuestionMessage,
  buildReplyToAnswerMessage,
  buildReplyToManualTargetMessage,
  buildReplyToQuestionMessage,
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
            quotedMessageId: z.string().optional(),
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

async function logLineApiCall(input: {
  userId?: number;
  itemId?: number;
  kind: LineApiCallKind;
  status: LineApiCallStatus;
  targetLineUserId?: string | null;
  messageCount?: number;
  estimatedBillableCount?: number;
  errorMessage?: string | null;
}) {
  await prisma.lineApiCallLog.create({
    data: {
      userId: input.userId,
      itemId: input.itemId,
      kind: input.kind,
      status: input.status,
      targetLineUserId: input.targetLineUserId || null,
      messageCount: input.messageCount || 0,
      estimatedBillableCount: input.estimatedBillableCount || 0,
      errorMessage: input.errorMessage?.slice(0, 500) || null,
    },
  });
}

async function replyMessages(
  replyToken: string,
  messages: LineMessage[],
  metadata?: { userId?: number; itemId?: number; targetLineUserId?: string | null },
) {
  const client = getLineClient();
  try {
    const response = await client.replyMessage({
      replyToken,
      messages,
    });

    await logLineApiCall({
      userId: metadata?.userId,
      itemId: metadata?.itemId,
      kind: LineApiCallKind.REPLY,
      status: LineApiCallStatus.SUCCESS,
      targetLineUserId: metadata?.targetLineUserId,
      messageCount: messages.length,
    });

    return response;
  } catch (error) {
    await logLineApiCall({
      userId: metadata?.userId,
      itemId: metadata?.itemId,
      kind: LineApiCallKind.REPLY,
      status: LineApiCallStatus.FAILED,
      targetLineUserId: metadata?.targetLineUserId,
      messageCount: messages.length,
      errorMessage: error instanceof Error ? error.message : "Unknown LINE reply error",
    });
    throw error;
  }
}

async function replyText(
  replyToken: string,
  text: string,
  metadata?: { userId?: number; itemId?: number; targetLineUserId?: string | null },
) {
  await replyMessages(replyToken, [
    {
      type: "text",
      text,
    },
  ], metadata);
}

async function pushMessages(
  to: string,
  messages: Array<
    { type: "text"; text: string } | { type: "image"; originalContentUrl: string; previewImageUrl: string }
  >,
  metadata?: { userId?: number; itemId?: number },
) {
  const client = getLineClient();
  try {
    const response = await client.pushMessage({
      to,
      messages,
    });

    await logLineApiCall({
      userId: metadata?.userId,
      itemId: metadata?.itemId,
      kind: LineApiCallKind.PUSH,
      status: LineApiCallStatus.SUCCESS,
      targetLineUserId: to,
      messageCount: messages.length,
      estimatedBillableCount: 1,
    });

    return response;
  } catch (error) {
    await logLineApiCall({
      userId: metadata?.userId,
      itemId: metadata?.itemId,
      kind: LineApiCallKind.PUSH,
      status: LineApiCallStatus.FAILED,
      targetLineUserId: to,
      messageCount: messages.length,
      errorMessage: error instanceof Error ? error.message : "Unknown LINE push error",
    });
    throw error;
  }
}

function getLastSentMessageId(response: { sentMessages: Array<{ id: string }> }) {
  return response.sentMessages.at(-1)?.id ?? null;
}

async function syncLineProfile(lineUserId: string) {
  try {
    const profile = await getLineClient().getProfile(lineUserId);

    const user = await prisma.user.upsert({
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

    await logLineApiCall({
      userId: user.id,
      kind: LineApiCallKind.PROFILE,
      status: LineApiCallStatus.SUCCESS,
      targetLineUserId: lineUserId,
    });

    return user;
  } catch (error) {
    console.warn("LINE profile fetch failed. Falling back to local user lookup.", {
      lineUserId,
      error,
    });

    await logLineApiCall({
      kind: LineApiCallKind.PROFILE,
      status: LineApiCallStatus.FAILED,
      targetLineUserId: lineUserId,
      errorMessage: error instanceof Error ? error.message : "Unknown LINE profile error",
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

async function findActiveConversationStateForAnswer(userId: number, quotedMessageId?: string) {
  if (quotedMessageId) {
    return prisma.activeConversationState.findFirst({
      where: {
        userId,
        OR: [
          { questionLineMessageId: quotedMessageId },
          { answerLineMessageId: quotedMessageId },
        ],
      },
      include: {
        item: {
          include: {
            images: {
              orderBy: {
                sortOrder: "asc",
              },
            },
          },
        },
      },
    });
  }

  return prisma.activeConversationState.findFirst({
    where: {
      userId,
    },
    include: {
      item: {
        include: {
          images: {
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

async function findActiveConversationStateForResult(userId: number, quotedMessageId?: string) {
  if (quotedMessageId) {
    return prisma.activeConversationState.findFirst({
      where: {
        userId,
        OR: [
          { questionLineMessageId: quotedMessageId },
          { answerLineMessageId: quotedMessageId },
        ],
      },
    });
  }

  return prisma.activeConversationState.findFirst({
    where: {
      userId,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

async function countActiveConversationStates(userId: number) {
  return prisma.activeConversationState.count({
    where: {
      userId,
    },
  });
}

async function handleAnswerRequest(
  userId: number,
  replyToken: string,
  rawText: string,
  quotedMessageId?: string,
) {
  if (!quotedMessageId && (await countActiveConversationStates(userId)) > 1) {
    await replyText(replyToken, buildReplyToQuestionMessage(), {
      userId,
    });
    return;
  }

  const activeState = await findActiveConversationStateForAnswer(userId, quotedMessageId);

  if (!activeState) {
    await replyText(replyToken, buildNoActiveQuestionMessage(), {
      userId,
    });
    return;
  }

  if (!canShowAnswer(activeState.state)) {
    await replyText(replyToken, buildAnswerFirstMessage(), {
      userId,
      itemId: activeState.itemId,
    });
    return;
  }

  const messages = buildAnswerReplyMessages(
    {
      questionNumber: activeState.item.questionNumber,
      answer: activeState.item.answer,
      answerImages: activeState.item.images.filter((image) => image.kind === "ANSWER"),
    },
    getPublicAppUrl(),
  );

  if (activeState.state === ConversationStateType.ANSWER_SHOWN) {
    await assertReachableImageMessages(messages);
    const response = await replyMessages(replyToken, messages, {
      userId,
      itemId: activeState.itemId,
    });

    await prisma.activeConversationState.update({
      where: {
        id: activeState.id,
      },
      data: {
        answerLineMessageId: getLastSentMessageId(response),
      },
    });
    return;
  }

  await assertReachableImageMessages(messages);
  const response = await replyMessages(replyToken, messages, {
    userId,
    itemId: activeState.itemId,
  });

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
        id: activeState.id,
      },
      data: {
        state: getConversationStateAfterAnswerShown(activeState.state)!,
        answerLineMessageId: getLastSentMessageId(response),
      },
    });

    await tx.reviewLog.create({
      data: {
        itemId: activeState.itemId,
        userId,
        actionType: ReviewActionType.ANSWER_SHOWN,
        rawText,
      },
    });
  });
}

async function handleResultRequest(
  userId: number,
  replyToken: string,
  result: "correct" | "incorrect",
  rawText: string,
  quotedMessageId?: string,
) {
  if (!quotedMessageId && (await countActiveConversationStates(userId)) > 1) {
    await replyText(replyToken, buildReplyToAnswerMessage(), {
      userId,
    });
    return;
  }

  const activeState = await findActiveConversationStateForResult(userId, quotedMessageId);

  if (!activeState) {
    await replyText(replyToken, buildNoActiveQuestionMessage(), {
      userId,
    });
    return;
  }

  if (!canJudgeAnswer(activeState.state)) {
    await replyText(replyToken, buildAnswerFirstMessage(), {
      userId,
      itemId: activeState.itemId,
    });
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
        id: activeState.id,
      },
    });
  });

  await replyText(
    replyToken,
    result === "correct"
      ? buildCorrectReplyMessage()
      : buildIncorrectReplyMessage(),
    {
      userId,
      itemId: activeState.itemId,
    },
  );
}

async function handleManualModeRequest(
  userId: number,
  replyToken: string,
  itemText: string,
  quotedMessageId?: string,
) {
  if (!quotedMessageId && (await countActiveConversationStates(userId)) > 1) {
    await replyText(replyToken, buildReplyToManualTargetMessage(), {
      userId,
    });
    return;
  }

  const activeState = await findActiveConversationStateForResult(userId, quotedMessageId);

  if (!activeState) {
    await replyText(replyToken, buildNoActiveQuestionMessage(), {
      userId,
    });
    return;
  }

  await prisma.productStudyItem.update({
    where: {
      id: activeState.itemId,
    },
    data: {
      autoSendEnabled: false,
    },
  });

  await replyText(replyToken, buildManualModeReplyMessage(), {
    userId,
    itemId: activeState.itemId,
  });

  console.info("LINE manual mode enabled", {
    userId,
    itemId: activeState.itemId,
    rawText: itemText,
  });
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
  const quotedMessageId = event.message.quotedMessageId;

  if (command === "answer") {
    await handleAnswerRequest(user.id, event.replyToken, event.message.text || "", quotedMessageId);
    return;
  }

  if (command === "correct") {
    await handleResultRequest(
      user.id,
      event.replyToken,
      "correct",
      event.message.text || "",
      quotedMessageId,
    );
    return;
  }

  if (command === "incorrect") {
    await handleResultRequest(
      user.id,
      event.replyToken,
      "incorrect",
      event.message.text || "",
      quotedMessageId,
    );
    return;
  }

  if (command === "manual") {
    await handleManualModeRequest(
      user.id,
      event.replyToken,
      event.message.text || "",
      quotedMessageId,
    );
    return;
  }

  await replyText(event.replyToken, buildLineHelpMessage(), {
    userId: user.id,
    targetLineUserId: lineUserId,
  });
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
  const batchSummaryTargets = new Map<string, { userId: number; questionNumbers: number[] }>();

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
    const latestSentLog =
      item.reviewLogs.find((log) => log.actionType === ReviewActionType.SENT) || null;

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

    console.info(
      "Dispatch decision debug",
      buildDispatchDecisionDebugInfo({
        itemId: item.id,
        questionNumber: item.questionNumber,
        autoSendEnabled: item.autoSendEnabled,
        status: item.status,
        nextScheduledAt: item.nextScheduledAt,
        latestSentAt: latestSentLog?.actionAt,
      }),
    );

    if (!dispatchDecision.shouldSend) {
      results.push({
        itemId: item.id,
        status: "skipped",
        reason: getDispatchSkipMessage(dispatchDecision.reason),
      });
      continue;
    }

    try {
      const messages =
        item.images.length > 0
          ? buildQuestionPushMessages(item, getPublicAppUrl())
          : [
              {
                type: "text" as const,
                text: buildQuestionMessage(item),
              },
            ];

      await assertReachableImageMessages(messages);
      const response = await pushMessages(lineUserId, messages, {
        userId: item.userId,
        itemId: item.id,
      });

      await prisma.$transaction(async (tx) => {
        await tx.productStudyItem.update({
          where: {
            id: item.id,
          },
          data: {
            nextScheduledAt:
              !itemIds && !force ? scheduleNextReview(1) : undefined,
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

        const existingState = await tx.activeConversationState.findFirst({
          where: {
            userId: item.userId,
            itemId: item.id,
          },
        });

        if (existingState) {
          await tx.activeConversationState.update({
            where: {
              id: existingState.id,
            },
            data: {
              state: getConversationStateAfterQuestionSent(),
              questionLineMessageId: getLastSentMessageId(response),
              answerLineMessageId: null,
            },
          });
        } else {
          await tx.activeConversationState.create({
            data: {
              userId: item.userId,
              itemId: item.id,
              state: getConversationStateAfterQuestionSent(),
              questionLineMessageId: getLastSentMessageId(response),
            },
          });
        }
      });

      results.push({
        itemId: item.id,
        status: "sent",
      });

      if (!itemIds) {
        const existingTarget = batchSummaryTargets.get(lineUserId);

        if (existingTarget) {
          existingTarget.questionNumbers.push(item.questionNumber);
        } else {
          batchSummaryTargets.set(lineUserId, {
            userId: item.userId,
            questionNumbers: [item.questionNumber],
          });
        }
      }
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

  if (!itemIds) {
    for (const [lineUserId, target] of batchSummaryTargets) {
      if (target.questionNumbers.length === 0) {
        continue;
      }

      try {
        await pushMessages(
          lineUserId,
          [
            {
              type: "text",
              text: buildBatchDispatchSummaryMessage(target.questionNumbers),
            },
          ],
          {
            userId: target.userId,
          },
        );
      } catch (error) {
        console.error("LINE batch summary send failed", {
          lineUserId,
          userId: target.userId,
          questionNumbers: target.questionNumbers,
          error,
        });
      }
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
