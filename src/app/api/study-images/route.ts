import { NextResponse } from "next/server";

import { ProductStudyImageKind } from "@/generated/prisma/client";
import { getAppSettings } from "@/lib/env";
import { getUploadPublicUrl, saveUploadedImages } from "@/lib/storage/local";
import { isAllowedImageFileLike, type StudyImageKindValue } from "@/lib/study/image-upload";

export const runtime = "nodejs";

function parseImageKind(value: FormDataEntryValue | null): StudyImageKindValue | null {
  if (value === "QUESTION" || value === "ANSWER") {
    return value;
  }

  return null;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const kind = parseImageKind(formData.get("kind"));
  const file = formData.get("file");

  if (!kind) {
    return NextResponse.json(
      {
        ok: false,
        error: "画像種別が不正です。",
      },
      {
        status: 400,
      },
    );
  }

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "画像ファイルを選択してください。",
      },
      {
        status: 400,
      },
    );
  }

  if (file.size > getAppSettings().maxUploadSizeBytes) {
    return NextResponse.json(
      {
        ok: false,
        error: `画像サイズは1枚あたり${getAppSettings().maxUploadSizeMb}MB以下にしてください。`,
      },
      {
        status: 400,
      },
    );
  }

  if (!isAllowedImageFileLike(file)) {
    return NextResponse.json(
      {
        ok: false,
        error: "画像形式は jpeg / png / webp / gif / heic / heif に対応しています。",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const [savedImage] = await saveUploadedImages(
      [file],
      kind === "QUESTION" ? ProductStudyImageKind.QUESTION : ProductStudyImageKind.ANSWER,
    );

    return NextResponse.json({
      ok: true,
      image: {
        imagePath: savedImage.imagePath,
        url: getUploadPublicUrl(savedImage.imagePath),
        fileName: file.name,
        kind,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "画像のアップロードに失敗しました。",
      },
      {
        status: 500,
      },
    );
  }
}
