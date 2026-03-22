import sharp from "sharp";
import { NextResponse } from "next/server";

import { getMimeTypeFromPath, readStoredImage } from "@/lib/storage/local";

type UploadRouteProps = {
  params: Promise<{
    path: string[];
  }>;
};

export const runtime = "nodejs";

async function renderLineImageVariant(file: Buffer, variant: "line-original" | "line-preview") {
  const width = variant === "line-preview" ? 240 : 1200;
  const quality = variant === "line-preview" ? 72 : 85;

  return sharp(file)
    .rotate()
    .resize({
      width,
      withoutEnlargement: true,
    })
    .jpeg({
      quality,
      mozjpeg: true,
    })
    .toBuffer();
}

export async function GET(request: Request, { params }: UploadRouteProps) {
  const resolvedParams = await params;
  const imagePath = resolvedParams.path.join("/");
  const variant = new URL(request.url).searchParams.get("variant");

  try {
    const file = await readStoredImage(imagePath);
    const isLineVariant = variant === "line-original" || variant === "line-preview";

    if (isLineVariant) {
      const rendered = await renderLineImageVariant(file, variant);

      return new NextResponse(new Uint8Array(rendered), {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    return new NextResponse(file, {
      headers: {
        "Content-Type": getMimeTypeFromPath(imagePath),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "画像が見つかりません。",
      },
      {
        status: 404,
      },
    );
  }
}
