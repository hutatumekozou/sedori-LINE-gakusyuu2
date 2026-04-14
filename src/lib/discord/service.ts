import {
  ConversationStateType,
  DiscordApiCallKind,
  DiscordApiCallStatus,
  ItemStatus,
  ReviewActionType,
} from "@/generated/prisma/client";

import {
  getCronSecret,
  getDefaultDiscordUserId,
  getDiscordStudyChannelId,
} from "@/lib/env";
import { scheduleNextReview } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import {
  buildAnswerDmMessages,
  buildQuestionDmMessages,
  type DiscordDmMessage,
} from "@/lib/discord/message-builder";
import {
  createDiscordDmChannel,
  sendDiscordChannelMessage,
  type DiscordUploadFile,
  type DiscordMessageResponse,
} from "@/lib/discord/api";
import { readStoredImage } from "@/lib/storage/local";
import {
  buildDispatchDecisionDebugInfo,
  getDispatchDecision,
  getDispatchSkipMessage,
  resolveChatTargetUserId,
} from "@/lib/study/dispatch-rules";
import {
  buildCategoryDispatchStartMessage,
  buildEmptyCategoryDispatchMessage,
  buildAnswerFirstMessage,
  buildBatchDispatchSummaryMessage,
  buildCorrectReplyMessage,
  buildDiscordQuestionMessage,
  buildDiscordHelpMessage,
  buildGreatCorrectReplyMessage,
  buildIncorrectReplyMessage,
  buildManualModeReplyMessage,
  buildNoActiveQuestionMessage,
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
import { getCategoryItemsForLineRequest, getDueItemsForDispatch } from "@/lib/study/service";

const DISCORD_MESSAGE_LIMIT = 1900;

type DiscordParsedCommand = {
  command: ReturnType<typeof normalizeLineCommand>;
  questionNumber: number | null;
};

function parseDiscordCommand(text: string): DiscordParsedCommand {
  const normalized = text.trim();
  const match = normalized.match(/^(大正解|正解|不正解|解答|手動)\s*#?\s*(\d+)?$/);

  if (!match) {
    return {
      command: normalizeLineCommand(normalized),
      questionNumber: null,
    };
  }

  return {
    command: normalizeLineCommand(match[1]),
    questionNumber: match[2] ? Number.parseInt(match[2], 10) : null,
  };
}

type QuestionSendItem = {
  id: number;
  userId: number;
  questionNumber: number;
  productName?: string | null;
  question: string;
  images: Array<{
    imagePath: string;
    sortOrder: number;
  }>;
};

function splitDiscordContent(text: string) {
  const normalized = text.trim();

  if (!normalized) {
    return [];
  }

  if (normalized.length <= DISCORD_MESSAGE_LIMIT) {
    return [normalized];
  }

  const chunks: string[] = [];
  let current = "";

  for (const line of normalized.split("\n")) {
    const nextValue = current ? `${current}\n${line}` : line;

    if (nextValue.length <= DISCORD_MESSAGE_LIMIT) {
      current = nextValue;
      continue;
    }

    if (current) {
      chunks.push(current);
    }

    if (line.length <= DISCORD_MESSAGE_LIMIT) {
      current = line;
      continue;
    }

    for (let index = 0; index < line.length; index += DISCORD_MESSAGE_LIMIT) {
      chunks.push(line.slice(index, index + DISCORD_MESSAGE_LIMIT));
    }

    current = "";
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function normalizeDiscordContents(contents: string[]) {
  return contents.flatMap((content) => splitDiscordContent(content));
}

function getSentMessageIds(messages: DiscordMessageResponse[]) {
  return messages.map((message) => message.id).filter(Boolean);
}

function getLastSentMessageId(messages: DiscordMessageResponse[]) {
  return getSentMessageIds(messages).at(-1) ?? null;
}

async function logDiscordApiCall(input: {
  userId?: number;
  itemId?: number;
  kind: DiscordApiCallKind;
  status: DiscordApiCallStatus;
  targetDiscordUserId?: string | null;
  channelId?: string | null;
  messageCount?: number;
  errorMessage?: string | null;
}) {
  await prisma.discordApiCallLog.create({
    data: {
      userId: input.userId,
      itemId: input.itemId,
      kind: input.kind,
      status: input.status,
      targetDiscordUserId: input.targetDiscordUserId || null,
      channelId: input.channelId || null,
      messageCount: input.messageCount || 0,
      errorMessage: input.errorMessage?.slice(0, 500) || null,
    },
  });
}

async function sendDiscordMessages(input: {
  kind: DiscordApiCallKind;
  targetDiscordUserId: string;
  messages: DiscordDmMessage[];
  channelId?: string;
  userId?: number;
  itemId?: number;
  replyToMessageId?: string;
}) {
  const messages: DiscordDmMessage[] = [];

  for (const message of input.messages) {
    if (message.type !== "text") {
      messages.push(message);
      continue;
    }

    for (const text of normalizeDiscordContents([message.text])) {
      messages.push({
        type: "text",
        text,
      });
    }
  }

  if (messages.length === 0) {
    return {
      channelId: input.channelId || null,
      sentMessages: [] as DiscordMessageResponse[],
    };
  }

  let channelId = input.channelId || null;

  try {
    if (!channelId) {
      const channel = await createDiscordDmChannel(input.targetDiscordUserId);
      channelId = channel.id;
    }

    const sentMessages: DiscordMessageResponse[] = [];

    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index];
      const file: DiscordUploadFile | undefined =
        message.type === "attachment"
          ? {
              data: await readStoredImage(message.imagePath),
              fileName: message.fileName,
              contentType: message.contentType,
            }
          : undefined;
      const response = await sendDiscordChannelMessage(
        channelId,
        message.type === "text"
          ? {
              content: message.text,
            }
          : {
              file,
            },
        {
          replyToMessageId: index === 0 ? input.replyToMessageId : undefined,
        },
      );
      sentMessages.push(response);
    }

    await logDiscordApiCall({
      userId: input.userId,
      itemId: input.itemId,
      kind: input.kind,
      status: DiscordApiCallStatus.SUCCESS,
      targetDiscordUserId: input.targetDiscordUserId,
      channelId,
      messageCount: messages.length,
    });

    return {
      channelId,
      sentMessages,
    };
  } catch (error) {
    await logDiscordApiCall({
      userId: input.userId,
      itemId: input.itemId,
      kind: input.kind,
      status: DiscordApiCallStatus.FAILED,
      targetDiscordUserId: input.targetDiscordUserId,
      channelId,
      messageCount: messages.length,
      errorMessage: error instanceof Error ? error.message : "Unknown Discord send error",
    });
    throw error;
  }
}

async function replyText(
  channelId: string,
  targetDiscordUserId: string,
  text: string,
  metadata?: {
    userId?: number;
    itemId?: number;
    replyToMessageId?: string;
  },
) {
  await sendDiscordMessages({
    kind: DiscordApiCallKind.REPLY,
    targetDiscordUserId,
    channelId,
    messages: [
      {
        type: "text",
        text,
      },
    ],
    userId: metadata?.userId,
    itemId: metadata?.itemId,
    replyToMessageId: metadata?.replyToMessageId,
  });
}

async function syncDiscordProfile(input: {
  discordUserId: string;
  displayName?: string | null;
}) {
  const existingUser = await prisma.user.findUnique({
    where: {
      discordUserId: input.discordUserId,
    },
    include: {
      _count: {
        select: {
          studyItems: true,
          activeConversationStates: true,
          reviewLogs: true,
        },
      },
    },
  });

  let user =
    existingUser
      ? {
          id: existingUser.id,
          lineUserId: existingUser.lineUserId,
          discordUserId: existingUser.discordUserId,
          displayName: existingUser.displayName,
          createdAt: existingUser.createdAt,
          updatedAt: existingUser.updatedAt,
        }
      : null;

  if (input.discordUserId === getDefaultDiscordUserId()) {
    const candidates = await prisma.user.findMany({
      where: {
        discordUserId: null,
        OR: [
          { studyItems: { some: {} } },
          { activeConversationStates: { some: {} } },
          { reviewLogs: { some: {} } },
        ],
      },
      include: {
        _count: {
          select: {
            studyItems: true,
            activeConversationStates: true,
            reviewLogs: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const bestCandidate =
      candidates
        .slice()
        .sort((left, right) => {
          const leftScore =
            left._count.studyItems * 100 +
            left._count.activeConversationStates * 10 +
            left._count.reviewLogs;
          const rightScore =
            right._count.studyItems * 100 +
            right._count.activeConversationStates * 10 +
            right._count.reviewLogs;

          return rightScore - leftScore;
        })
        .at(0) ?? null;

    const shouldReplaceOrphanedDiscordUser =
      !!existingUser &&
      existingUser._count.studyItems === 0 &&
      existingUser._count.activeConversationStates === 0 &&
      existingUser._count.reviewLogs === 0 &&
      !!bestCandidate;

    if (shouldReplaceOrphanedDiscordUser && bestCandidate) {
      user = await prisma.$transaction(async (tx) => {
        await tx.user.delete({
          where: {
            id: existingUser.id,
          },
        });

        return tx.user.update({
          where: {
            id: bestCandidate.id,
          },
          data: {
            discordUserId: input.discordUserId,
            displayName: input.displayName || bestCandidate.displayName || undefined,
          },
        });
      });

      console.info("Discord user reassigned to existing study user", {
        fromUserId: existingUser.id,
        toUserId: user.id,
        discordUserId: input.discordUserId,
      });
    } else if (!user && bestCandidate) {
      user = await prisma.user.update({
        where: {
          id: bestCandidate.id,
        },
        data: {
          discordUserId: input.discordUserId,
          displayName: input.displayName || bestCandidate.displayName || undefined,
        },
      });

      console.info("Discord user linked to existing study user", {
        userId: user.id,
        discordUserId: input.discordUserId,
      });
    }
  }

  if (!user) {
    user = await prisma.user.create({
      data: {
        discordUserId: input.discordUserId,
        displayName: input.displayName || undefined,
      },
    });
  } else if (user.displayName !== (input.displayName || null)) {
    user = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        displayName: input.displayName || undefined,
      },
    });
  }

  await logDiscordApiCall({
    userId: user.id,
    kind: DiscordApiCallKind.PROFILE,
    status: DiscordApiCallStatus.SUCCESS,
    targetDiscordUserId: input.discordUserId,
  });

  return user;
}

async function findActiveConversationStateForAnswer(
  userId: number,
  referencedMessageId?: string,
  questionNumber?: number | null,
) {
  if (referencedMessageId) {
    return prisma.activeConversationState.findFirst({
      where: {
        userId,
        OR: [
          { questionDiscordMessageId: referencedMessageId },
          { questionDiscordMessageIds: { has: referencedMessageId } },
          { answerDiscordMessageId: referencedMessageId },
          { answerDiscordMessageIds: { has: referencedMessageId } },
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

  if (questionNumber) {
    return prisma.activeConversationState.findFirst({
      where: {
        userId,
        item: {
          questionNumber,
        },
        OR: [
          { questionDiscordMessageId: { not: null } },
          { questionDiscordMessageIds: { isEmpty: false } },
          { answerDiscordMessageId: { not: null } },
          { answerDiscordMessageIds: { isEmpty: false } },
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
      OR: [
        { questionDiscordMessageId: { not: null } },
        { questionDiscordMessageIds: { isEmpty: false } },
        { answerDiscordMessageId: { not: null } },
        { answerDiscordMessageIds: { isEmpty: false } },
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
    orderBy: {
      updatedAt: "desc",
    },
  });
}

async function findActiveConversationStateForResult(userId: number, referencedMessageId?: string) {
  if (referencedMessageId) {
    return prisma.activeConversationState.findFirst({
      where: {
        userId,
        OR: [
          { questionDiscordMessageId: referencedMessageId },
          { questionDiscordMessageIds: { has: referencedMessageId } },
          { answerDiscordMessageId: referencedMessageId },
          { answerDiscordMessageIds: { has: referencedMessageId } },
        ],
      },
    });
  }

  return prisma.activeConversationState.findFirst({
    where: {
      userId,
      OR: [
        { questionDiscordMessageId: { not: null } },
        { questionDiscordMessageIds: { isEmpty: false } },
        { answerDiscordMessageId: { not: null } },
        { answerDiscordMessageIds: { isEmpty: false } },
      ],
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

async function findActiveConversationStateForResultByQuestionNumber(
  userId: number,
  questionNumber?: number | null,
) {
  if (!questionNumber) {
    return null;
  }

  return prisma.activeConversationState.findFirst({
    where: {
      userId,
      item: {
        questionNumber,
      },
      OR: [
        { questionDiscordMessageId: { not: null } },
        { questionDiscordMessageIds: { isEmpty: false } },
        { answerDiscordMessageId: { not: null } },
        { answerDiscordMessageIds: { isEmpty: false } },
      ],
    },
  });
}

async function countActiveConversationStates(userId: number) {
  return prisma.activeConversationState.count({
    where: {
      userId,
      OR: [
        { questionDiscordMessageId: { not: null } },
        { questionDiscordMessageIds: { isEmpty: false } },
        { answerDiscordMessageId: { not: null } },
        { answerDiscordMessageIds: { isEmpty: false } },
      ],
    },
  });
}

async function findSingleActiveConversationStateForAnswer(userId: number) {
  if ((await countActiveConversationStates(userId)) !== 1) {
    return null;
  }

  return findActiveConversationStateForAnswer(userId);
}

async function findSingleActiveConversationStateForResult(userId: number) {
  if ((await countActiveConversationStates(userId)) !== 1) {
    return null;
  }

  return findActiveConversationStateForResult(userId);
}

async function handleAnswerRequest(
  userId: number,
  discordUserId: string,
  channelId: string,
  rawText: string,
  sourceMessageId: string,
  referencedMessageId?: string,
  questionNumber?: number | null,
) {
  let activeState = await findActiveConversationStateForAnswer(
    userId,
    referencedMessageId,
    questionNumber,
  );

  if (!activeState && referencedMessageId) {
    activeState = await findSingleActiveConversationStateForAnswer(userId);
  }

  if (!activeState) {
    if (referencedMessageId && (await countActiveConversationStates(userId)) > 0) {
      await replyText(channelId, discordUserId, buildReplyToQuestionMessage(), {
        userId,
        replyToMessageId: sourceMessageId,
      });
      return;
    }

    await replyText(channelId, discordUserId, buildNoActiveQuestionMessage(), {
      userId,
      replyToMessageId: sourceMessageId,
    });
    return;
  }

  if (!canShowAnswer(activeState.state)) {
    await replyText(channelId, discordUserId, buildAnswerFirstMessage(), {
      userId,
      itemId: activeState.itemId,
      replyToMessageId: sourceMessageId,
    });
    return;
  }

  const response = await sendDiscordMessages({
    kind: DiscordApiCallKind.REPLY,
    targetDiscordUserId: discordUserId,
    channelId,
    messages: buildAnswerDmMessages(
      {
        questionNumber: activeState.item.questionNumber,
        answer: activeState.item.answer,
        answerImages: activeState.item.images.filter((image) => image.kind === "ANSWER"),
      },
    ),
    userId,
    itemId: activeState.itemId,
    replyToMessageId: sourceMessageId,
  });

  if (activeState.state === ConversationStateType.ANSWER_SHOWN) {
    await prisma.activeConversationState.update({
      where: {
        id: activeState.id,
      },
      data: {
        answerDiscordMessageId: getLastSentMessageId(response.sentMessages),
        answerDiscordMessageIds: getSentMessageIds(response.sentMessages),
      },
    });
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
        id: activeState.id,
      },
      data: {
        state: getConversationStateAfterAnswerShown(activeState.state)!,
        answerDiscordMessageId: getLastSentMessageId(response.sentMessages),
        answerDiscordMessageIds: getSentMessageIds(response.sentMessages),
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
  discordUserId: string,
  channelId: string,
  result: "greatCorrect" | "correct" | "incorrect",
  rawText: string,
  sourceMessageId: string,
  referencedMessageId?: string,
  questionNumber?: number | null,
) {
  let activeState = await findActiveConversationStateForResult(userId, referencedMessageId);

  if (!activeState && questionNumber) {
    activeState = await findActiveConversationStateForResultByQuestionNumber(userId, questionNumber);
  }

  if (!activeState && referencedMessageId) {
    activeState = await findSingleActiveConversationStateForResult(userId);
  }

  if (!activeState) {
    if (referencedMessageId && (await countActiveConversationStates(userId)) > 0) {
      await replyText(channelId, discordUserId, buildReplyToAnswerMessage(), {
        userId,
        replyToMessageId: sourceMessageId,
      });
      return;
    }

    await replyText(channelId, discordUserId, buildNoActiveQuestionMessage(), {
      userId,
      replyToMessageId: sourceMessageId,
    });
    return;
  }

  if (!canJudgeAnswer(activeState.state)) {
    await replyText(channelId, discordUserId, buildAnswerFirstMessage(), {
      userId,
      itemId: activeState.itemId,
      replyToMessageId: sourceMessageId,
    });
    return;
  }

  const nextScheduledAt = calculateNextScheduledAtFromResult(result);
  const actionType =
    result === "greatCorrect"
      ? ReviewActionType.GREAT_CORRECT
      : result === "correct"
        ? ReviewActionType.CORRECT
        : ReviewActionType.INCORRECT;
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
    channelId,
    discordUserId,
    result === "greatCorrect"
      ? buildGreatCorrectReplyMessage()
      : result === "correct"
        ? buildCorrectReplyMessage()
        : buildIncorrectReplyMessage(),
    {
      userId,
      itemId: activeState.itemId,
      replyToMessageId: sourceMessageId,
    },
  );
}

async function handleManualModeRequest(
  userId: number,
  discordUserId: string,
  channelId: string,
  itemText: string,
  sourceMessageId: string,
  referencedMessageId?: string,
  questionNumber?: number | null,
) {
  let activeState = await findActiveConversationStateForResult(userId, referencedMessageId);

  if (!activeState && questionNumber) {
    activeState = await findActiveConversationStateForResultByQuestionNumber(userId, questionNumber);
  }

  if (!activeState && referencedMessageId) {
    activeState = await findSingleActiveConversationStateForResult(userId);
  }

  if (!activeState) {
    if (referencedMessageId && (await countActiveConversationStates(userId)) > 0) {
      await replyText(channelId, discordUserId, buildReplyToManualTargetMessage(), {
        userId,
        replyToMessageId: sourceMessageId,
      });
      return;
    }

    await replyText(channelId, discordUserId, buildNoActiveQuestionMessage(), {
      userId,
      replyToMessageId: sourceMessageId,
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

  await replyText(channelId, discordUserId, buildManualModeReplyMessage(), {
    userId,
    itemId: activeState.itemId,
    replyToMessageId: sourceMessageId,
  });

  console.info("Discord manual mode enabled", {
    userId,
    itemId: activeState.itemId,
    rawText: itemText,
  });
}

async function sendQuestionItem(
  item: QuestionSendItem,
  discordUserId: string,
  options?: {
    rescheduleAfterSend?: boolean;
    channelId?: string;
  },
) {
  const contents =
    item.images.length > 0
      ? buildQuestionDmMessages(item)
      : [{ type: "text" as const, text: buildDiscordQuestionMessage(item) }];

  const response = await sendDiscordMessages({
    kind: DiscordApiCallKind.PUSH,
    targetDiscordUserId: discordUserId,
    messages: contents,
    channelId: options?.channelId,
    userId: item.userId,
    itemId: item.id,
  });

  await prisma.$transaction(async (tx) => {
    await tx.productStudyItem.update({
      where: {
        id: item.id,
      },
      data: {
        nextScheduledAt: options?.rescheduleAfterSend ? scheduleNextReview(1) : undefined,
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
          questionDiscordMessageId: getLastSentMessageId(response.sentMessages),
          questionDiscordMessageIds: getSentMessageIds(response.sentMessages),
          answerDiscordMessageId: null,
          answerDiscordMessageIds: [],
        },
      });
      return;
    }

    await tx.activeConversationState.create({
      data: {
        userId: item.userId,
        itemId: item.id,
        state: getConversationStateAfterQuestionSent(),
        questionDiscordMessageId: getLastSentMessageId(response.sentMessages),
        questionDiscordMessageIds: getSentMessageIds(response.sentMessages),
      },
    });
  });
}

async function handleCategoryRequest(
  userId: number,
  discordUserId: string,
  channelId: string,
  rawText: string,
  sourceMessageId: string,
) {
  const selection = await getCategoryItemsForLineRequest(userId, rawText);

  if (!selection.matched) {
    return false;
  }

  if (selection.items.length === 0) {
    await replyText(channelId, discordUserId, buildEmptyCategoryDispatchMessage(selection.category), {
      userId,
      replyToMessageId: sourceMessageId,
    });
    return true;
  }

  await replyText(
    channelId,
    discordUserId,
    buildCategoryDispatchStartMessage(selection.category, selection.items.length),
    {
      userId,
      replyToMessageId: sourceMessageId,
    },
  );

  for (const item of selection.items) {
    await sendQuestionItem(item, discordUserId, {
      channelId,
    });
  }

  await sendDiscordMessages({
    kind: DiscordApiCallKind.PUSH,
    targetDiscordUserId: discordUserId,
    channelId,
    messages: [
      {
        type: "text",
        text: buildBatchDispatchSummaryMessage(selection.items.map((item) => item.questionNumber)),
      },
    ],
    userId,
  });

  return true;
}

export async function handleDiscordDirectMessage(input: {
  discordUserId: string;
  displayName?: string | null;
  channelId: string;
  text: string;
  sourceMessageId: string;
  referencedMessageId?: string;
}) {
  const rawText = input.text.trim();

  if (!rawText) {
    return;
  }

  const user = await syncDiscordProfile({
    discordUserId: input.discordUserId,
    displayName: input.displayName,
  });
  const parsedCommand = parseDiscordCommand(rawText);
  const command = parsedCommand.command;

  console.info("Discord DM command", {
    userId: user.id,
    discordUserId: input.discordUserId,
    channelId: input.channelId,
    sourceMessageId: input.sourceMessageId,
    referencedMessageId: input.referencedMessageId || null,
    rawText,
    command,
    questionNumber: parsedCommand.questionNumber,
  });

  if (command === "answer") {
    await handleAnswerRequest(
      user.id,
      input.discordUserId,
      input.channelId,
      rawText,
      input.sourceMessageId,
      input.referencedMessageId,
      parsedCommand.questionNumber,
    );
    return;
  }

  if (command === "correct") {
    await handleResultRequest(
      user.id,
      input.discordUserId,
      input.channelId,
      "correct",
      rawText,
      input.sourceMessageId,
      input.referencedMessageId,
      parsedCommand.questionNumber,
    );
    return;
  }

  if (command === "greatCorrect") {
    await handleResultRequest(
      user.id,
      input.discordUserId,
      input.channelId,
      "greatCorrect",
      rawText,
      input.sourceMessageId,
      input.referencedMessageId,
      parsedCommand.questionNumber,
    );
    return;
  }

  if (command === "incorrect") {
    await handleResultRequest(
      user.id,
      input.discordUserId,
      input.channelId,
      "incorrect",
      rawText,
      input.sourceMessageId,
      input.referencedMessageId,
      parsedCommand.questionNumber,
    );
    return;
  }

  if (command === "manual") {
    await handleManualModeRequest(
      user.id,
      input.discordUserId,
      input.channelId,
      rawText,
      input.sourceMessageId,
      input.referencedMessageId,
      parsedCommand.questionNumber,
    );
    return;
  }

  if (
    await handleCategoryRequest(
      user.id,
      input.discordUserId,
      input.channelId,
      rawText,
      input.sourceMessageId,
    )
  ) {
    return;
  }

  await replyText(input.channelId, input.discordUserId, buildDiscordHelpMessage(), {
    userId: user.id,
    replyToMessageId: input.sourceMessageId,
  });
}

export async function dispatchStudyItems(itemIds?: number[], force = false) {
  const items = await getDueItemsForDispatch(itemIds);
  const results: Array<{ itemId: number; status: "sent" | "skipped" | "failed"; reason?: string }> = [];
  const defaultDiscordUserId = getDefaultDiscordUserId();
  const studyChannelId = getDiscordStudyChannelId();
  const batchSummaryTargets = new Map<string, { userId: number; questionNumbers: number[] }>();
  const shouldSendBatchSummary = itemIds === undefined || itemIds.length > 1;

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
    const discordUserId = resolveChatTargetUserId(item.user.discordUserId, defaultDiscordUserId);
    const latestSentLog =
      item.reviewLogs.find((log) => log.actionType === ReviewActionType.SENT) || null;

    if (!discordUserId) {
      results.push({
        itemId: item.id,
        status: "failed",
        reason:
          "送信先の Discord userId が未設定です。DISCORD_DEFAULT_USER_ID を設定するか、対象ユーザーに discordUserId を紐付けてください。",
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
      await sendQuestionItem(item, discordUserId, {
        channelId: studyChannelId || undefined,
        rescheduleAfterSend: !itemIds && !force,
      });

      results.push({
        itemId: item.id,
        status: "sent",
      });

      const existingTarget = batchSummaryTargets.get(discordUserId);

      if (existingTarget) {
        existingTarget.questionNumbers.push(item.questionNumber);
      } else {
        batchSummaryTargets.set(discordUserId, {
          userId: item.userId,
          questionNumbers: [item.questionNumber],
        });
      }
    } catch (error) {
      results.push({
        itemId: item.id,
        status: "failed",
        reason: error instanceof Error ? error.message : "送信に失敗しました。",
      });
      console.error("Discord DM send failed", {
        itemId: item.id,
        questionNumber: item.questionNumber,
        discordUserId,
        error,
      });
    }
  }

  if (shouldSendBatchSummary) {
    for (const [discordUserId, target] of batchSummaryTargets) {
      if (target.questionNumbers.length === 0) {
        continue;
      }

      try {
        await sendDiscordMessages({
          kind: DiscordApiCallKind.PUSH,
          targetDiscordUserId: discordUserId,
          channelId: studyChannelId || undefined,
          messages: [
            {
              type: "text",
              text: buildBatchDispatchSummaryMessage(target.questionNumbers),
            },
          ],
          userId: target.userId,
        });
      } catch (error) {
        console.error("Discord batch summary send failed", {
          discordUserId,
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
