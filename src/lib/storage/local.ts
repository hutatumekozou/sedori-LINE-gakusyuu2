import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { ProductStudyImageKind } from "@/generated/prisma/client";
import { getResolvedUploadStorageDir } from "@/lib/env";

export type SavedImage = {
  kind: ProductStudyImageKind;
  imagePath: string;
  sortOrder: number;
};

function getUploadRoot() {
  return getResolvedUploadStorageDir();
}

function normalizeRelativePath(relativePath: string) {
  return relativePath.replaceAll("\\", "/");
}

function getImageExtension(fileName: string) {
  return path.extname(fileName).toLowerCase() || ".jpg";
}

export function getUploadPublicUrl(imagePath: string) {
  return `/api/uploads/${normalizeRelativePath(imagePath)}`;
}

export function resolveUploadPath(imagePath: string) {
  const uploadRoot = getUploadRoot();
  const resolvedPath = path.resolve(uploadRoot, imagePath);

  if (!resolvedPath.startsWith(uploadRoot)) {
    throw new Error("不正な画像パスです。");
  }

  return resolvedPath;
}

export function getMimeTypeFromPath(imagePath: string) {
  const extension = path.extname(imagePath).toLowerCase();

  switch (extension) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".heic":
      return "image/heic";
    case ".heif":
      return "image/heif";
    default:
      return "image/jpeg";
  }
}

export async function saveUploadedImages(
  files: File[],
  kind: ProductStudyImageKind,
): Promise<SavedImage[]> {
  const uploadRoot = getUploadRoot();
  const now = new Date();
  const folder = path.join(
    uploadRoot,
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, "0"),
  );

  await mkdir(folder, { recursive: true });

  return Promise.all(
    files.map(async (file, index) => {
      const fileName = `${Date.now()}-${randomUUID()}${getImageExtension(file.name)}`;
      const fullPath = path.join(folder, fileName);
      const relativePath = path.relative(uploadRoot, fullPath);
      const buffer = Buffer.from(await file.arrayBuffer());

      await writeFile(fullPath, buffer);

      return {
        kind,
        imagePath: normalizeRelativePath(relativePath),
        sortOrder: index,
      };
    }),
  );
}

export async function readStoredImage(imagePath: string) {
  return readFile(resolveUploadPath(imagePath));
}

export async function deleteStoredImage(imagePath: string) {
  try {
    await unlink(resolveUploadPath(imagePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export async function fileToDataUrl(file: File) {
  const mimeType = file.type || getMimeTypeFromPath(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export async function storedImageToDataUrl(imagePath: string) {
  const mimeType = getMimeTypeFromPath(imagePath);
  const buffer = await readStoredImage(imagePath);
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}
