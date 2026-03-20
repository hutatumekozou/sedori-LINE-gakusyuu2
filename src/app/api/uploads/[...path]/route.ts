import { NextResponse } from "next/server";

import { getMimeTypeFromPath, readStoredImage } from "@/lib/storage/local";

type UploadRouteProps = {
  params: Promise<{
    path: string[];
  }>;
};

export async function GET(_request: Request, { params }: UploadRouteProps) {
  const resolvedParams = await params;
  const imagePath = resolvedParams.path.join("/");

  try {
    const file = await readStoredImage(imagePath);

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
