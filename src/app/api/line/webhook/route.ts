import { NextResponse } from "next/server";

import { handleLineWebhook } from "@/lib/line/service";

export async function POST(request: Request) {
  const signature = request.headers.get("x-line-signature");

  if (!signature) {
    return NextResponse.json(
      {
        ok: false,
        error: "署名ヘッダーがありません。",
      },
      {
        status: 400,
      },
    );
  }

  const rawBody = await request.text();

  try {
    await handleLineWebhook(rawBody, signature);

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error("LINE webhook error", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "LINE webhook の処理に失敗しました。",
      },
      {
        status: 400,
      },
    );
  }
}
