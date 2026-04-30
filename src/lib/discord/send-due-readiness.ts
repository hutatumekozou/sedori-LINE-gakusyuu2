import { formatInTimeZone } from "date-fns-tz";

import { ReviewActionType } from "@/generated/prisma/client";
import { getAppDayStart } from "@/lib/date";
import { prisma } from "@/lib/prisma";
import { dispatchStudyItems } from "@/lib/discord/service";
import { sendDiscordChannelMessage } from "@/lib/discord/api";
import { getAppSettings, getDefaultDiscordUserId, getDiscordBotConfig, getDiscordStudyChannelId, getPublicAppUrl } from "@/lib/env";
import { readStoredImage } from "@/lib/storage/local";
import { resolveChatTargetUserId } from "@/lib/study/dispatch-rules";
import { getDueItemsForDispatch } from "@/lib/study/service";

export const HEALTHCHECK_QUESTION_NUMBERS = [4, 5] as const;

type ReadinessCheck = {
  name: string;
  ok: boolean;
  detail: string;
};

type ReadinessCandidate = {
  itemId: number;
  questionNumber: number;
  status: "ready" | "failed";
  reason?: string;
};

export type SendDueReadinessResult = {
  ok: boolean;
  checkedAt: string;
  dueItemCount: number;
  questionNumbers: number[];
  checks: ReadinessCheck[];
  candidates: ReadinessCandidate[];
};

async function assertDiscordBotToken() {
  const { botToken } = getDiscordBotConfig();
  const response = await fetch("https://discord.com/api/v10/users/@me", {
    headers: {
      Authorization: `Bot ${botToken}`,
    },
    cache: "no-store",
  });

  if (response.ok) {
    return;
  }

  const bodyText = await response.text();
  throw new Error(
    bodyText
      ? `Discord bot token の確認に失敗しました。${bodyText}`
      : `Discord bot token の確認に失敗しました。status=${response.status}`,
  );
}

async function assertDiscordStudyChannel(channelId: string) {
  const { botToken } = getDiscordBotConfig();
  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
    headers: {
      Authorization: `Bot ${botToken}`,
    },
    cache: "no-store",
  });

  if (response.ok) {
    return;
  }

  const bodyText = await response.text();
  throw new Error(
    bodyText
      ? `Discord channel の確認に失敗しました。${bodyText}`
      : `Discord channel の確認に失敗しました。status=${response.status}`,
  );
}

async function fetchSiteStatus(url: string) {
  const response = await fetch(url, {
    method: "GET",
    redirect: "manual",
    cache: "no-store",
  });

  return {
    status: response.status,
    location: response.headers.get("location"),
  };
}

function isSuccessOrRedirect(status: number) {
  return status === 200 || status === 301 || status === 302 || status === 307 || status === 308;
}

function formatCheckedAt(date: Date) {
  return formatInTimeZone(date, getAppSettings().appTimeZone, "yyyy/MM/dd HH:mm");
}

function buildFailureNotification(result: SendDueReadinessResult) {
  const failedChecks = result.checks.filter((check) => !check.ok);
  const failedCandidates = result.candidates.filter((candidate) => candidate.status === "failed");

  return [
    "【12時送信 事前チェックNG】",
    `確認時刻: ${result.checkedAt}`,
    `送信候補件数: ${result.dueItemCount}件`,
    ...failedChecks.map((check) => `- ${check.name}: ${check.detail}`),
    ...failedCandidates.slice(0, 5).map(
      (candidate) => `- 問題番号${candidate.questionNumber}: ${candidate.reason || "送信前チェックに失敗しました。"}`,
    ),
  ].join("\n");
}

function buildSuccessNotification(result: SendDueReadinessResult) {
  const readyCount = result.candidates.filter((candidate) => candidate.status === "ready").length;
  const questionSummary =
    result.questionNumbers.length === 0
      ? "なし"
      : result.questionNumbers.slice(0, 10).join(", ");

  return [
    "【12時送信 事前チェックOK】",
    `確認時刻: ${result.checkedAt}`,
    `送信候補件数: ${result.dueItemCount}件`,
    `送信可能: ${readyCount}/${result.candidates.length}件`,
    `問題番号: ${questionSummary}`,
  ].join("\n");
}

export async function runSendDueReadinessCheck(): Promise<SendDueReadinessResult> {
  const checkedAt = formatCheckedAt(new Date());
  const checks: ReadinessCheck[] = [];
  const candidates: ReadinessCandidate[] = [];
  const defaultDiscordUserId = getDefaultDiscordUserId();
  const studyChannelId = getDiscordStudyChannelId();
  const publicAppUrl = getPublicAppUrl();

  let dueItems: Awaited<ReturnType<typeof getDueItemsForDispatch>> = [];

  try {
    const site = await fetchSiteStatus(publicAppUrl);
    checks.push({
      name: "本番URL疎通",
      ok: isSuccessOrRedirect(site.status),
      detail:
        site.location
          ? `status=${site.status} location=${site.location}`
          : `status=${site.status}`,
    });
  } catch (error) {
    checks.push({
      name: "本番URL疎通",
      ok: false,
      detail: error instanceof Error ? error.message : "本番URLの確認に失敗しました。",
    });
  }

  try {
    const login = await fetchSiteStatus(`${publicAppUrl}/login`);
    checks.push({
      name: "ログイン画面疎通",
      ok: login.status === 200 || login.status === 302,
      detail:
        login.location
          ? `status=${login.status} location=${login.location}`
          : `status=${login.status}`,
    });
  } catch (error) {
    checks.push({
      name: "ログイン画面疎通",
      ok: false,
      detail: error instanceof Error ? error.message : "ログイン画面の確認に失敗しました。",
    });
  }

  try {
    dueItems = await getDueItemsForDispatch();
    checks.push({
      name: "本番DB接続",
      ok: true,
      detail: `送信候補を${dueItems.length}件取得できました。`,
    });
  } catch (error) {
    checks.push({
      name: "本番DB接続",
      ok: false,
      detail: error instanceof Error ? error.message : "送信候補の取得に失敗しました。",
    });

    return {
      ok: false,
      checkedAt,
      dueItemCount: 0,
      questionNumbers: [],
      checks,
      candidates,
    };
  }

  try {
    await assertDiscordBotToken();
    checks.push({
      name: "Discord bot token",
      ok: true,
      detail: "有効です。",
    });
  } catch (error) {
    checks.push({
      name: "Discord bot token",
      ok: false,
      detail: error instanceof Error ? error.message : "Discord bot token の確認に失敗しました。",
    });
  }

  if (!studyChannelId) {
    checks.push({
      name: "Discord送信先チャンネル",
      ok: false,
      detail: "DISCORD_STUDY_CHANNEL_ID が未設定です。",
    });
  } else {
    try {
      await assertDiscordStudyChannel(studyChannelId);
      checks.push({
        name: "Discord送信先チャンネル",
        ok: true,
        detail: studyChannelId,
      });
    } catch (error) {
      checks.push({
        name: "Discord送信先チャンネル",
        ok: false,
        detail: error instanceof Error ? error.message : "Discord送信先チャンネルの確認に失敗しました。",
      });
    }
  }

  if (!defaultDiscordUserId) {
    checks.push({
      name: "既定Discord userId",
      ok: false,
      detail: "DISCORD_DEFAULT_USER_ID が未設定です。",
    });
  } else {
    checks.push({
      name: "既定Discord userId",
      ok: true,
      detail: defaultDiscordUserId,
    });
  }

  for (const item of dueItems) {
    try {
      const discordUserId = resolveChatTargetUserId(item.user.discordUserId, defaultDiscordUserId);

      if (!discordUserId) {
        throw new Error(
          "送信先の Discord userId が未設定です。DISCORD_DEFAULT_USER_ID を設定するか、対象ユーザーに discordUserId を紐付けてください。",
        );
      }

      await Promise.all(item.images.map((image) => readStoredImage(image.imagePath)));

      candidates.push({
        itemId: item.id,
        questionNumber: item.questionNumber,
        status: "ready",
      });
    } catch (error) {
      candidates.push({
        itemId: item.id,
        questionNumber: item.questionNumber,
        status: "failed",
        reason: error instanceof Error ? error.message : "送信前チェックに失敗しました。",
      });
    }
  }

  checks.push({
    name: "送信候補の個別確認",
    ok: candidates.every((candidate) => candidate.status === "ready"),
    detail:
      candidates.length === 0
        ? "送信候補はありません。"
        : `${candidates.filter((candidate) => candidate.status === "ready").length}/${candidates.length}件が送信可能です。`,
  });

  return {
    ok: checks.every((check) => check.ok),
    checkedAt,
    dueItemCount: dueItems.length,
    questionNumbers: dueItems.map((item) => item.questionNumber),
    checks,
    candidates,
  };
}

export async function notifySendDueReadinessFailure(result: SendDueReadinessResult) {
  const studyChannelId = getDiscordStudyChannelId();

  if (!studyChannelId) {
    return;
  }

  await sendDiscordChannelMessage(studyChannelId, {
    content: buildFailureNotification(result),
  });
}

export async function notifySendDueReadinessSuccess(result: SendDueReadinessResult) {
  const studyChannelId = getDiscordStudyChannelId();

  if (!studyChannelId) {
    return;
  }

  await sendDiscordChannelMessage(studyChannelId, {
    content: buildSuccessNotification(result),
  });
}

export async function dispatchHealthcheckQuestions() {
  const todayStart = getAppDayStart();
  const items = await prisma.productStudyItem.findMany({
    where: {
      deletedAt: null,
      questionNumber: {
        in: [...HEALTHCHECK_QUESTION_NUMBERS],
      },
    },
    select: {
      id: true,
      questionNumber: true,
    },
    orderBy: {
      questionNumber: "asc",
    },
  });

  const foundQuestionNumbers = items.map((item) => item.questionNumber);
  const missingQuestionNumbers = HEALTHCHECK_QUESTION_NUMBERS.filter(
    (questionNumber) => !foundQuestionNumbers.includes(questionNumber),
  );

  if (missingQuestionNumbers.length > 0) {
    return {
      ok: false as const,
      detail: `動作確認用の問題番号 ${missingQuestionNumbers.join(", ")} が見つかりません。`,
    };
  }

  const sentTodayLogs = await prisma.reviewLog.findMany({
    where: {
      itemId: {
        in: items.map((item) => item.id),
      },
      actionType: ReviewActionType.SENT,
      actionAt: {
        gte: todayStart,
      },
    },
    select: {
      itemId: true,
    },
  });

  const sentTodayItemIds = new Set(sentTodayLogs.map((log) => log.itemId));
  const remainingItems = items.filter((item) => !sentTodayItemIds.has(item.id));
  const alreadySentQuestionNumbers = items
    .filter((item) => sentTodayItemIds.has(item.id))
    .map((item) => item.questionNumber);

  if (remainingItems.length === 0) {
    return {
      ok: true as const,
      detail: `動作確認用の問題番号 ${alreadySentQuestionNumbers.join(", ")} は本日すでに送信済みです。`,
    };
  }

  const result = await dispatchStudyItems(
    remainingItems.map((item) => item.id),
    true,
  );

  if (result.failedCount > 0) {
    const failedItemIds = result.results
      .filter((entry) => entry.status === "failed")
      .map((entry) => entry.itemId);

    return {
      ok: false as const,
      detail: `動作確認用問題の送信に失敗しました。失敗 itemId: ${failedItemIds.join(", ")}`,
    };
  }

  return {
    ok: true as const,
    detail:
      alreadySentQuestionNumbers.length > 0
        ? `動作確認用の問題番号 ${remainingItems.map((item) => item.questionNumber).join(", ")} を送信しました。${alreadySentQuestionNumbers.join(", ")} は本日送信済みのため再送していません。`
        : `動作確認用の問題番号 ${remainingItems.map((item) => item.questionNumber).join(", ")} を送信しました。`,
  };
}
