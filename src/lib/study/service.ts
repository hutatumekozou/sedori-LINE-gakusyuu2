import {
  ItemStatus,
  ProductStudyImageKind,
  ReviewActionType,
} from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";

import { getLatestDispatchCheckpoint, isDueToday } from "@/lib/date";
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
  brandName?: string | null;
  note: string;
  memo?: string | null;
}) {
  const titleParts = [input.brandName, input.productName].filter(Boolean);
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
  productName: string | null;
  brandName: string | null;
  summary: string;
  nextScheduledAt: Date;
  status: ItemStatus;
  difficulty: string;
  lastResult: LastResult;
  createdAt: Date;
  isDueToday: boolean;
};

export type DeletedStudyListItem = {
  id: number;
  questionNumber: number;
  productName: string | null;
  brandName: string | null;
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
  const [items, recentLogs, correctCount, incorrectCount] = await Promise.all([
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
  ]);

  const dueTodayItems = items
    .filter((item) => item.autoSendEnabled && isDueToday(item.nextScheduledAt))
    .map((item) => ({
      id: item.id,
      questionNumber: item.questionNumber,
      productName: item.productName,
      brandName: item.brandName,
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
    recentLogs,
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

  return items
    .map((item) => {
      const lastResult = getLastResultFromLogs(item.reviewLogs);

      return {
        id: item.id,
        questionNumber: item.questionNumber,
        autoSendEnabled: item.autoSendEnabled,
        productName: item.productName,
        brandName: item.brandName,
        summary: item.summary,
        nextScheduledAt: item.nextScheduledAt,
        status: item.status,
        difficulty: item.difficulty,
        lastResult,
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
          item.brandName || "",
          item.summary,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      const matchesStatus = !filters.status || filters.status === "ALL" || item.status === filters.status;
      const matchesToday = !filters.todayOnly || item.isDueToday;

      return matchesQuery && matchesStatus && matchesToday;
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
      brandName: true,
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
  brandName?: string;
  note: string;
  memo?: string;
  firstScheduledAt: Date;
  questionFiles: File[];
  answerFiles: File[];
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
        brandName: input.brandName,
        category: null,
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
  const shouldReplaceQuestionImages = input.questionFiles.length > 0;
  const shouldReplaceAnswerImages = input.answerFiles.length > 0;
  const [savedQuestionImages, savedAnswerImages] = await Promise.all([
    shouldReplaceQuestionImages
      ? saveUploadedImages(input.questionFiles, ProductStudyImageKind.QUESTION)
      : Promise.resolve(null),
    shouldReplaceAnswerImages
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
        brandName: input.brandName,
        category: null,
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
    brandName: item.brandName,
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
