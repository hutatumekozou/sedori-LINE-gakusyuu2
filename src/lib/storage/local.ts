import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { BlobError, del, get, put } from "@vercel/blob";

import type { ProductStudyImageKind } from "@/generated/prisma/client";
import { getResolvedUploadStorageDir } from "@/lib/env";
import {
  fromBlobImagePath,
  getImageExtension,
  isBlobImagePath,
  normalizeStoredImagePath,
  toBlobImagePath,
} from "@/lib/study/image-upload";

export type SavedImage = {
  kind: ProductStudyImageKind;
  imagePath: string;
  sortOrder: number;
};

export type FileLike = {
  name: string;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

const BLOB_ACCESS_TYPES = ["private", "public"] as const;
type BlobAccessType = (typeof BLOB_ACCESS_TYPES)[number];

let resolvedBlobAccessType: BlobAccessType | null = null;

function getUploadRoot() {
  return getResolvedUploadStorageDir();
}

function isBlobStorageEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function getBlobToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();

  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN が設定されていません。");
  }

  return token;
}

function getConfiguredBlobAccessType(): BlobAccessType | null {
  const value = process.env.BLOB_STORE_ACCESS?.trim().toLowerCase();

  if (value === "private" || value === "public") {
    return value;
  }

  return null;
}

function getBlobAccessCandidates() {
  if (resolvedBlobAccessType) {
    return [resolvedBlobAccessType];
  }

  const configured = getConfiguredBlobAccessType();

  if (configured) {
    return [configured];
  }

  return [...BLOB_ACCESS_TYPES];
}

function isBlobAccessMismatch(error: unknown) {
  return (
    error instanceof BlobError &&
    (error.message.includes("Cannot use private access on a public store") ||
      error.message.includes("Cannot use public access on a private store"))
  );
}

async function putBlobWithResolvedAccess(pathname: string, body: Blob, contentType: string) {
  let lastError: unknown;

  for (const access of getBlobAccessCandidates()) {
    try {
      const uploaded = await put(pathname, body, {
        access,
        addRandomSuffix: false,
        contentType,
        token: getBlobToken(),
      });

      resolvedBlobAccessType = access;
      return uploaded;
    } catch (error) {
      lastError = error;

      if (!isBlobAccessMismatch(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

async function getBlobWithResolvedAccess(pathname: string) {
  let lastError: unknown;

  for (const access of getBlobAccessCandidates()) {
    try {
      const result = await get(pathname, {
        access,
        token: getBlobToken(),
      });

      resolvedBlobAccessType = access;
      return result;
    } catch (error) {
      lastError = error;

      if (!isBlobAccessMismatch(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

function buildStoredBlobPath(kind: ProductStudyImageKind, fileName: string, now: Date) {
  return normalizeStoredImagePath(
    path.join(
      kind.toLowerCase(),
      String(now.getFullYear()),
      String(now.getMonth() + 1).padStart(2, "0"),
      `${Date.now()}-${randomUUID()}${getImageExtension(fileName)}`,
    ),
  );
}

export function getUploadPublicUrl(imagePath: string) {
  return `/api/uploads/${normalizeStoredImagePath(imagePath)}`;
}

export function resolveUploadPath(imagePath: string) {
  if (isBlobImagePath(imagePath)) {
    throw new Error("Blob保存画像にはローカルパスはありません。");
  }

  const uploadRoot = getUploadRoot();
  const resolvedPath = path.resolve(uploadRoot, imagePath);

  if (!resolvedPath.startsWith(uploadRoot)) {
    throw new Error("不正な画像パスです。");
  }

  return resolvedPath;
}

export function getMimeTypeFromPath(imagePath: string) {
  const normalizedPath = isBlobImagePath(imagePath) ? fromBlobImagePath(imagePath) : imagePath;
  const extension = path.extname(normalizedPath).toLowerCase();

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

async function saveUploadedImagesToLocal(
  files: FileLike[],
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
        imagePath: normalizeStoredImagePath(relativePath),
        sortOrder: index,
      };
    }),
  );
}

async function saveUploadedImagesToBlob(
  files: FileLike[],
  kind: ProductStudyImageKind,
): Promise<SavedImage[]> {
  const now = new Date();

  return Promise.all(
    files.map(async (file, index) => {
      const pathname = buildStoredBlobPath(kind, file.name, now);
      const buffer = Buffer.from(await file.arrayBuffer());
      const contentType = file.type || getMimeTypeFromPath(file.name);
      const uploaded = await putBlobWithResolvedAccess(
        pathname,
        new Blob([buffer], { type: contentType }),
        contentType,
      );

      return {
        kind,
        imagePath: toBlobImagePath(uploaded.pathname),
        sortOrder: index,
      };
    }),
  );
}

export async function saveUploadedImages(
  files: FileLike[],
  kind: ProductStudyImageKind,
): Promise<SavedImage[]> {
  if (isBlobStorageEnabled()) {
    return saveUploadedImagesToBlob(files, kind);
  }

  return saveUploadedImagesToLocal(files, kind);
}

export async function readStoredImage(imagePath: string) {
  if (isBlobImagePath(imagePath)) {
    const result = await getBlobWithResolvedAccess(fromBlobImagePath(imagePath));

    if (!result || result.statusCode !== 200 || !result.stream) {
      throw new Error("Blob画像が見つかりません。");
    }

    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }

  return readFile(resolveUploadPath(imagePath));
}

export async function deleteStoredImage(imagePath: string) {
  if (isBlobImagePath(imagePath)) {
    try {
      await del(fromBlobImagePath(imagePath), {
        token: getBlobToken(),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        "name" in error &&
        typeof error.name === "string" &&
        error.name === "BlobNotFoundError"
      ) {
        return;
      }

      throw error;
    }

    return;
  }

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
