import { NextResponse } from "next/server";

import {
  dispatchHealthcheckQuestions,
  notifySendDueReadinessFailure,
  notifySendDueReadinessSuccess,
  runSendDueReadinessCheck,
} from "@/lib/discord/send-due-readiness";
import { assertCronSecret } from "@/lib/discord/service";

function extractSecret(request: Request) {
  const authorization = request.headers.get("authorization");

  if (authorization?.startsWith("Bearer ")) {
    return authorization.replace("Bearer ", "");
  }

  return request.headers.get("x-cron-secret");
}

export async function POST(request: Request) {
  return handleSendDueReadinessRequest(request);
}

export async function GET(request: Request) {
  return handleSendDueReadinessRequest(request);
}

function shouldNotifySuccess(request: Request) {
  const { searchParams } = new URL(request.url);
  return searchParams.get("silent") !== "1";
}

function shouldSendHealthcheckItems(request: Request) {
  const { searchParams } = new URL(request.url);
  return searchParams.get("skipHealthcheckItems") !== "1";
}

async function handleSendDueReadinessRequest(request: Request) {
  const secret = extractSecret(request);

  if (!assertCronSecret(secret)) {
    return NextResponse.json(
      {
        ok: false,
        error: "認証に失敗しました。",
      },
      {
        status: 401,
      },
    );
  }

  try {
    let result = await runSendDueReadinessCheck();

    if (!result.ok) {
      try {
        await notifySendDueReadinessFailure(result);
      } catch (notifyError) {
        console.error("Send due readiness notify error", notifyError);
      }

      return NextResponse.json(
        result,
        {
          status: 500,
        },
      );
    }

    if (shouldSendHealthcheckItems(request)) {
      const healthcheckDispatch = await dispatchHealthcheckQuestions();

      result = {
        ...result,
        ok: result.ok && healthcheckDispatch.ok,
        checks: [
          ...result.checks,
          {
            name: "11時動作確認問題送信",
            ok: healthcheckDispatch.ok,
            detail: healthcheckDispatch.detail,
          },
        ],
      };

      if (!healthcheckDispatch.ok) {
        try {
          await notifySendDueReadinessFailure(result);
        } catch (notifyError) {
          console.error("Send due readiness notify error", notifyError);
        }

        return NextResponse.json(
          result,
          {
            status: 500,
          },
        );
      }
    }

    if (shouldNotifySuccess(request)) {
      try {
        await notifySendDueReadinessSuccess(result);
      } catch (notifyError) {
        console.error("Send due readiness success notify error", notifyError);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Send due readiness API error", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "送信前チェックに失敗しました。",
      },
      {
        status: 500,
      },
    );
  }
}
