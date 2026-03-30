import {
  GeminiApiCallStatus,
  ItemStatus,
  LineApiCallKind,
  LineApiCallStatus,
  ProductStudyImageKind,
  ReviewActionType,
} from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";

import { getDaysSince, getLatestDispatchCheckpoint, isDueToday, scheduleNextReview } from "@/lib/date";
import { getDefaultLineUserId } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import {
  getUploadPublicUrl,
  saveUploadedImages,
} from "@/lib/storage/local";
import { sortDispatchCandidates } from "@/lib/study/dispatch-rules";
import { getLastResultFromLogs } from "@/lib/study/review-state";
import type { LastResult, StudyItemFilters } from "@/lib/study/types";

type JsonArray = Prisma.JsonValue | null;

function buildStoredStudyContent(input: {
  productName?: string | null;
  category?: string | null;
  note: string;
  memo?: string | null;
}) {
  const titleParts = [input.category, input.productName].filter(Boolean);
  const summaryBase = titleParts.length > 0 ? titleParts.join(" / ") : input.note;

  return {
    summary: summaryBase.slice(0, 300),
    question: input.note,
    answer: input.memo || "",
    explanation: input.memo || "",
    difficulty: "medium" as const,
    tags: [],
    keyPoints: [],
  };
}

export type StudyListItem = {
  id: number;
  questionNumber: number;
  autoSendEnabled: boolean;
  isFavorite: boolean;
  productName: string | null;
  category: string | null;
  summary: string;
  lastStudiedAt: Date | null;
  nextScheduledAt: Date;
  status: ItemStatus;
  difficulty: string;
  lastResult: LastResult;
  correctCount: number;
  createdAt: Date;
  isDueToday: boolean;
};

export type DeletedStudyListItem = {
  id: number;
  questionNumber: number;
  productName: string | null;
  category: string | null;
  createdAt: Date;
  deletedAt: Date;
};

function parseJsonStringArray(value: JsonArray) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function getOrCreateDefaultUser() {
  const defaultLineUserId = getDefaultLineUserId();

  if (defaultLineUserId) {
    const existingByLine = await prisma.user.findUnique({
      where: {
        lineUserId: defaultLineUserId,
      },
    });

    if (existingByLine) {
      return existingByLine;
    }

    const existingLocalUser = await prisma.user.findFirst({
      where: {
        lineUserId: null,
      },
      orderBy: {
        id: "asc",
      },
    });

    if (existingLocalUser) {
      return prisma.user.update({
        where: {
          id: existingLocalUser.id,
        },
        data: {
          lineUserId: defaultLineUserId,
          displayName: existingLocalUser.displayName || "LINE利用者",
        },
      });
    }

    return prisma.user.create({
      data: {
        lineUserId: defaultLineUserId,
        displayName: "LINE利用者",
      },
    });
  }

  const existingLocalUser = await prisma.user.findFirst({
    where: {
      lineUserId: null,
    },
    orderBy: {
      id: "asc",
    },
  });

  if (existingLocalUser) {
    return existingLocalUser;
  }

  return prisma.user.create({
    data: {
      displayName: "ローカル利用者",
    },
  });
}

export async function getDashboardData() {
  const [
    items,
    recentLogs,
    correctCount,
    incorrectCount,
    geminiCallCount,
    geminiSuccessCount,
    geminiFailureCount,
    recentGeminiLogs,
    lineApiCallCount,
    linePushCount,
    lineReplyCount,
    lineEstimatedBillableCount,
    recentLineLogs,
  ] = await Promise.all([
    prisma.productStudyItem.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        reviewLogs: {
          orderBy: {
            actionAt: "desc",
          },
        },
      },
      orderBy: [
        {
          nextScheduledAt: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    }),
    prisma.reviewLog.findMany({
      include: {
        item: true,
        user: true,
      },
      orderBy: {
        actionAt: "desc",
      },
      take: 10,
    }),
    prisma.reviewLog.count({
      where: {
        actionType: ReviewActionType.CORRECT,
      },
    }),
    prisma.reviewLog.count({
      where: {
        actionType: ReviewActionType.INCORRECT,
      },
    }),
    prisma.geminiApiCallLog.count(),
    prisma.geminiApiCallLog.count({
      where: {
        status: GeminiApiCallStatus.SUCCESS,
      },
    }),
    prisma.geminiApiCallLog.count({
      where: {
        status: GeminiApiCallStatus.FAILED,
      },
    }),
    prisma.geminiApiCallLog.findMany({
      include: {
        user: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    }),
    prisma.lineApiCallLog.count(),
    prisma.lineApiCallLog.count({
      where: {
        kind: LineApiCallKind.PUSH,
      },
    }),
    prisma.lineApiCallLog.count({
      where: {
        kind: LineApiCallKind.REPLY,
      },
    }),
    prisma.lineApiCallLog.aggregate({
      _sum: {
        estimatedBillableCount: true,
      },
      where: {
        kind: LineApiCallKind.PUSH,
        status: LineApiCallStatus.SUCCESS,
      },
    }),
    prisma.lineApiCallLog.findMany({
      include: {
        user: true,
        item: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    }),
  ]);

  const dueTodayItems = items
    .filter((item) => item.autoSendEnabled && isDueToday(item.nextScheduledAt))
    .map((item) => ({
      id: item.id,
      questionNumber: item.questionNumber,
      productName: item.productName,
      category: item.category,
      status: item.status,
      nextScheduledAt: item.nextScheduledAt,
    }));

  const unsentCount = items.filter(
    (item) => !item.reviewLogs.some((log) => log.actionType === "SENT"),
  ).length;

  return {
    totalCount: items.length,
    dueTodayCount: dueTodayItems.length,
    unsentCount,
    correctCount,
    incorrectCount,
    geminiCallCount,
    geminiSuccessCount,
    geminiFailureCount,
    lineApiCallCount,
    linePushCount,
    lineReplyCount,
    lineEstimatedBillableCount: lineEstimatedBillableCount._sum.estimatedBillableCount || 0,
    recentLogs,
    recentGeminiLogs,
    recentLineLogs,
    dueTodayItems,
  };
}

export async function getStudyItems(
  filters: StudyItemFilters = {},
): Promise<StudyListItem[]> {
  const items = await prisma.productStudyItem.findMany({
    where: {
      deletedAt: null,
    },
    include: {
      reviewLogs: {
        orderBy: {
          actionAt: "desc",
        },
      },
    },
    orderBy: {
      questionNumber: "asc",
    },
  });

  const normalizedQuery = filters.query?.trim().toLowerCase() || "";

  const filteredItems = items
    .map((item) => {
      const lastResult = getLastResultFromLogs(item.reviewLogs);
      const lastStudiedAt =
        item.reviewLogs.find(
          (log) =>
            log.actionType === ReviewActionType.ANSWER_SHOWN ||
            log.actionType === ReviewActionType.CORRECT ||
            log.actionType === ReviewActionType.INCORRECT,
        )?.actionAt || null;

      return {
        id: item.id,
        questionNumber: item.questionNumber,
        autoSendEnabled: item.autoSendEnabled,
        isFavorite: item.isFavorite,
        productName: item.productName,
        category: item.category,
        summary: item.summary,
        lastStudiedAt,
        nextScheduledAt: item.nextScheduledAt,
        status: item.status,
        difficulty: item.difficulty,
        lastResult,
        correctCount: item.reviewLogs.filter((log) => log.actionType === ReviewActionType.CORRECT).length,
        createdAt: item.createdAt,
        isDueToday: isDueToday(item.nextScheduledAt),
      };
    })
    .filter((item) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [
          item.questionNumber.toString(),
          item.productName || "",
          item.category || "",
          item.summary,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      const matchesStatus =
        !filters.status ||
        filters.status === "ALL" ||
        (filters.status === ItemStatus.QUESTION_SENT
          ? item.status === ItemStatus.QUESTION_SENT || item.status === ItemStatus.ANSWER_SHOWN
          : item.status === filters.status);
      const matchesCategory =
        !filters.category || filters.category === "ALL" || (item.category || "その他") === filters.category;
      const matchesSendMode =
        !filters.sendMode ||
        filters.sendMode === "ALL" ||
        (filters.sendMode === "AUTO" && item.autoSendEnabled) ||
        (filters.sendMode === "MANUAL" && !item.autoSendEnabled);
      const matchesFavorite = !filters.favoriteOnly || item.isFavorite;
      const matchesToday = !filters.todayOnly || item.isDueToday;

      return (
        matchesQuery &&
        matchesStatus &&
        matchesCategory &&
        matchesSendMode &&
        matchesFavorite &&
        matchesToday
      );
    });

  if (!filters.elapsedDaysOrder || filters.elapsedDaysOrder === "NONE") {
    return filteredItems;
  }

  return filteredItems.toSorted((a, b) => {
    if (!a.lastStudiedAt && !b.lastStudiedAt) {
      return a.questionNumber - b.questionNumber;
    }

    if (!a.lastStudiedAt) {
      return 1;
    }

    if (!b.lastStudiedAt) {
      return -1;
    }

    const dayDiff = getDaysSince(a.lastStudiedAt) - getDaysSince(b.lastStudiedAt);

    if (dayDiff === 0) {
      return a.questionNumber - b.questionNumber;
    }

    return filters.elapsedDaysOrder === "ASC" ? dayDiff : -dayDiff;
  });
}

export async function getDeletedStudyItems(): Promise<DeletedStudyListItem[]> {
  return prisma.productStudyItem.findMany({
    where: {
      deletedAt: {
        not: null,
      },
    },
    select: {
      id: true,
      questionNumber: true,
      productName: true,
      category: true,
      createdAt: true,
      deletedAt: true,
    },
    orderBy: {
      questionNumber: "asc",
    },
  }) as Promise<DeletedStudyListItem[]>;
}

export async function getStudyItemDetail(itemId: number) {
  const item = await prisma.productStudyItem.findUnique({
    where: {
      id: itemId,
    },
    include: {
      images: {
        orderBy: {
          sortOrder: "asc",
        },
      },
      reviewLogs: {
        include: {
          user: true,
        },
        orderBy: {
          actionAt: "desc",
        },
      },
      activeConversations: true,
      user: true,
    },
  });

  if (!item) {
    return null;
  }

  if (item.deletedAt) {
    return null;
  }

  return {
    ...item,
    tags: parseJsonStringArray(item.tags),
    keyPoints: parseJsonStringArray(item.keyPoints),
    lastResult: getLastResultFromLogs(item.reviewLogs),
    questionImageUrls: item.images
      .filter((image) => image.kind === ProductStudyImageKind.QUESTION)
      .map((image) => ({
        id: image.id,
        imagePath: image.imagePath,
        url: getUploadPublicUrl(image.imagePath),
      })),
    answerImageUrls: item.images
      .filter((image) => image.kind === ProductStudyImageKind.ANSWER)
      .map((image) => ({
        id: image.id,
        imagePath: image.imagePath,
        url: getUploadPublicUrl(image.imagePath),
      })),
    imageUrls: item.images.map((image) => ({
      id: image.id,
      imagePath: image.imagePath,
      url: getUploadPublicUrl(image.imagePath),
    })),
  };
}

type CreateStudyItemInput = {
  autoSendEnabled: boolean;
  productName?: string;
  category: string;
  note: string;
  memo?: string;
  firstScheduledAt: Date;
  questionFiles: File[];
  answerFiles: File[];
  removeQuestionImages: boolean;
  removeAnswerImages: boolean;
};

export async function createStudyItem(input: CreateStudyItemInput) {
  const user = await getOrCreateDefaultUser();
  const content = buildStoredStudyContent(input);

  const [savedQuestionImages, savedAnswerImages] = await Promise.all([
    saveUploadedImages(input.questionFiles, ProductStudyImageKind.QUESTION),
    saveUploadedImages(input.answerFiles, ProductStudyImageKind.ANSWER),
  ]);

  return prisma.$transaction(async (tx) => {
    const latestItem = await tx.productStudyItem.findFirst({
      orderBy: {
        questionNumber: "desc",
      },
      select: {
        questionNumber: true,
      },
    });

    return tx.productStudyItem.create({
      data: {
        userId: user.id,
        questionNumber: (latestItem?.questionNumber || 0) + 1,
        autoSendEnabled: input.autoSendEnabled,
        productName: input.productName,
        category: input.category,
        note: input.note,
        memo: input.memo,
        firstScheduledAt: input.firstScheduledAt,
        nextScheduledAt: input.firstScheduledAt,
        status: ItemStatus.PENDING,
        summary: content.summary,
        question: content.question,
        answer: content.answer,
        explanation: content.explanation,
        difficulty: content.difficulty,
        tags: content.tags,
        keyPoints: content.keyPoints,
        images: {
          create: [...savedQuestionImages, ...savedAnswerImages],
        },
      },
    });
  });
}

type UpdateStudyItemInput = CreateStudyItemInput;

export async function updateStudyItem(itemId: number, input: UpdateStudyItemInput) {
  const existingItem = await prisma.productStudyItem.findUnique({
    where: {
      id: itemId,
    },
    include: {
      reviewLogs: true,
    },
  });

  if (!existingItem) {
    throw new Error("対象の問題が見つかりませんでした。");
  }

  const sentCount = existingItem.reviewLogs.filter((log) => log.actionType === "SENT").length;
  const [savedQuestionImages, savedAnswerImages] = await Promise.all([
    input.questionFiles.length > 0
      ? saveUploadedImages(input.questionFiles, ProductStudyImageKind.QUESTION)
      : Promise.resolve(null),
    input.answerFiles.length > 0
      ? saveUploadedImages(input.answerFiles, ProductStudyImageKind.ANSWER)
      : Promise.resolve(null),
  ]);
  const content = buildStoredStudyContent(input);

  return prisma.$transaction(async (tx) => {
    await tx.productStudyItem.update({
      where: {
        id: itemId,
      },
      data: {
        autoSendEnabled: input.autoSendEnabled,
        productName: input.productName,
        category: input.category,
        note: input.note,
        memo: input.memo,
        firstScheduledAt: input.firstScheduledAt,
        nextScheduledAt: sentCount === 0 ? input.firstScheduledAt : undefined,
        status: sentCount === 0 ? ItemStatus.PENDING : undefined,
        summary: content.summary,
        question: content.question,
        answer: content.answer,
        explanation: content.explanation,
        difficulty: content.difficulty,
        tags: content.tags,
        keyPoints: content.keyPoints,
      },
    });

    if (savedQuestionImages) {
      await tx.productStudyImage.deleteMany({
        where: {
          itemId,
          kind: ProductStudyImageKind.QUESTION,
        },
      });

      await tx.productStudyImage.createMany({
        data: savedQuestionImages.map((image) => ({
          itemId,
          kind: image.kind,
          imagePath: image.imagePath,
          sortOrder: image.sortOrder,
        })),
      });
    }

    if (savedAnswerImages) {
      await tx.productStudyImage.deleteMany({
        where: {
          itemId,
          kind: ProductStudyImageKind.ANSWER,
        },
      });

      await tx.productStudyImage.createMany({
        data: savedAnswerImages.map((image) => ({
          itemId,
          kind: image.kind,
          imagePath: image.imagePath,
          sortOrder: image.sortOrder,
        })),
      });
    }
  });
}

export async function regenerateStudyItem(itemId: number) {
  const item = await prisma.productStudyItem.findUnique({
    where: {
      id: itemId,
    },
  });

  if (!item) {
    throw new Error("対象の問題が見つかりませんでした。");
  }

  const content = buildStoredStudyContent({
    productName: item.productName,
    category: item.category,
    note: item.note,
    memo: item.memo,
  });

  await prisma.productStudyItem.update({
    where: {
      id: itemId,
    },
    data: {
      summary: content.summary,
      question: content.question,
      answer: content.answer,
      explanation: content.explanation,
      difficulty: content.difficulty,
      tags: content.tags,
      keyPoints: content.keyPoints,
    },
  });
}

export async function updateManualSchedule(itemId: number, nextScheduledAt: Date) {
  await prisma.$transaction(async (tx) => {
    await tx.productStudyItem.update({
      where: {
        id: itemId,
      },
      data: {
        nextScheduledAt,
        status: ItemStatus.PENDING,
      },
    });

    await tx.activeConversationState.deleteMany({
      where: {
        itemId,
      },
    });
  });
}

export async function updateAutoSendEnabled(itemId: number, autoSendEnabled: boolean) {
  const item = await prisma.productStudyItem.findUnique({
    where: {
      id: itemId,
    },
    select: {
      id: true,
      autoSendEnabled: true,
    },
  });

  if (!item) {
    throw new Error("対象の問題が見つかりませんでした。");
  }

  await prisma.productStudyItem.update({
    where: {
      id: itemId,
    },
    data: {
      autoSendEnabled,
      nextScheduledAt:
        autoSendEnabled && !item.autoSendEnabled ? scheduleNextReview(1) : undefined,
    },
  });
}

export async function updateFavorite(itemId: number, isFavorite: boolean) {
  const item = await prisma.productStudyItem.findUnique({
    where: {
      id: itemId,
    },
    select: {
      id: true,
    },
  });

  if (!item) {
    throw new Error("対象の問題が見つかりませんでした。");
  }

  await prisma.productStudyItem.update({
    where: {
      id: itemId,
    },
    data: {
      isFavorite,
    },
  });
}

export async function deleteStudyItem(itemId: number) {
  const item = await prisma.productStudyItem.findUnique({
    where: {
      id: itemId,
    },
  });

  if (!item) {
    throw new Error("対象の問題が見つかりませんでした。");
  }

  await prisma.$transaction(async (tx) => {
    await tx.productStudyItem.update({
      where: {
        id: itemId,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    await tx.activeConversationState.deleteMany({
      where: {
        itemId,
      },
    });
  });
}

export async function restoreStudyItem(itemId: number) {
  const item = await prisma.productStudyItem.findUnique({
    where: {
      id: itemId,
    },
    select: {
      id: true,
      deletedAt: true,
    },
  });

  if (!item) {
    throw new Error("対象の問題が見つかりませんでした。");
  }

  if (!item.deletedAt) {
    return;
  }

  await prisma.productStudyItem.update({
    where: {
      id: itemId,
    },
    data: {
      deletedAt: null,
    },
  });
}

export async function getLatestSentLog(itemId: number) {
  return prisma.reviewLog.findFirst({
    where: {
      itemId,
      actionType: ReviewActionType.SENT,
    },
    orderBy: {
      actionAt: "desc",
    },
  });
}

export async function getDueItemsForDispatch(itemIds?: number[]) {
  const dueBoundary = getLatestDispatchCheckpoint();
  const items = await prisma.productStudyItem.findMany({
    where: {
      ...(itemIds
        ? { id: { in: itemIds } }
        : { autoSendEnabled: true, deletedAt: null, nextScheduledAt: { lte: dueBoundary } }),
    },
    include: {
      images: {
        orderBy: {
          sortOrder: "asc",
        },
      },
      user: true,
      reviewLogs: {
        where: {
          actionType: {
            in: [ReviewActionType.SENT, ReviewActionType.CORRECT, ReviewActionType.INCORRECT],
          },
        },
        orderBy: {
          actionAt: "desc",
        },
        take: 10,
      },
    },
  });

  if (itemIds) {
    return items.map((item) => ({
      ...item,
      images: item.images.filter((image) => image.kind === ProductStudyImageKind.QUESTION),
      answerImages: item.images.filter((image) => image.kind === ProductStudyImageKind.ANSWER),
    }));
  }

  return sortDispatchCandidates(
    items.map((item) => ({
      ...item,
      images: item.images.filter((image) => image.kind === ProductStudyImageKind.QUESTION),
      answerImages: item.images.filter((image) => image.kind === ProductStudyImageKind.ANSWER),
      latestSentAt:
        item.reviewLogs.find((log) => log.actionType === ReviewActionType.SENT)?.actionAt || null,
      latestSolvedAt:
        item.reviewLogs.find(
          (log) =>
            log.actionType === ReviewActionType.CORRECT ||
            log.actionType === ReviewActionType.INCORRECT,
        )?.actionAt || null,
    })),
  ).slice(0, 10);
}

export type StudyDetailItem = NonNullable<Awaited<ReturnType<typeof getStudyItemDetail>>>;
export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
export type StudyLastResult = LastResult;
