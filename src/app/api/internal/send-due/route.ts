import { NextResponse } from "next/server";

import { assertCronSecret, dispatchStudyItems } from "@/lib/discord/service";

function extractSecret(request: Request) {
  const authorization = request.headers.get("authorization");

  if (authorization?.startsWith("Bearer ")) {
    return authorization.replace("Bearer ", "");
  }

  return request.headers.get("x-cron-secret");
}

export async function POST(request: Request) {
  return handleSendDueRequest(request);
}

export async function GET(request: Request) {
  return handleSendDueRequest(request);
}

async function handleSendDueRequest(request: Request) {
  const secret = extractSecret(request);
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";

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
    const result = await dispatchStudyItems(undefined, force);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("Send due items API error", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "送信処理に失敗しました。",
      },
      {
        status: 500,
      },
    );
  }
}
