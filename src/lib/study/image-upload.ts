const BLOB_IMAGE_PREFIX = "blob:";
const SUPPORTED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"];
const SUPPORTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];

export type StudyImageKindValue = "QUESTION" | "ANSWER";

type ImageFileLike = {
  name: string;
  type?: string | null;
};

function normalizePathSeparators(value: string) {
  return value.replaceAll("\\", "/");
}

function createUploadSuffix() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 10);
}

export function getImageExtension(fileName: string) {
  const normalizedName = fileName.trim().toLowerCase();

  for (const extension of SUPPORTED_IMAGE_EXTENSIONS) {
    if (normalizedName.endsWith(extension)) {
      return extension;
    }
  }

  return ".jpg";
}

export function isAllowedImageFileLike(file: ImageFileLike) {
  const normalizedType = file.type?.trim().toLowerCase() || "";
  const extension = getImageExtension(file.name);

  return (
    SUPPORTED_IMAGE_MIME_TYPES.includes(normalizedType) ||
    SUPPORTED_IMAGE_EXTENSIONS.includes(extension)
  );
}

export function normalizeStoredImagePath(imagePath: string) {
  return normalizePathSeparators(imagePath).replace(/^\/+/, "");
}

export function toBlobImagePath(pathname: string) {
  return `${BLOB_IMAGE_PREFIX}${normalizeStoredImagePath(pathname)}`;
}

export function isBlobImagePath(imagePath: string) {
  return imagePath.startsWith(BLOB_IMAGE_PREFIX);
}

export function fromBlobImagePath(imagePath: string) {
  return imagePath.slice(BLOB_IMAGE_PREFIX.length);
}

export function isValidStoredImagePath(imagePath: string) {
  const normalized = normalizeStoredImagePath(imagePath);

  if (!normalized || normalized.includes("\0")) {
    return false;
  }

  if (isBlobImagePath(normalized)) {
    const blobPath = fromBlobImagePath(normalized);
    return blobPath.length > 0 && !blobPath.includes("..") && blobPath.includes("/");
  }

  return !normalized.includes("..") && normalized.includes("/");
}

export function buildStudyImageUploadPath(
  kind: StudyImageKindValue,
  fileName: string,
  now: Date = new Date(),
) {
  return [
    kind.toLowerCase(),
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, "0"),
    `${Date.now()}-${createUploadSuffix()}${getImageExtension(fileName)}`,
  ].join("/");
}

export function parseUploadedImagePaths(formData: FormData, fieldName: string) {
  return formData
    .getAll(fieldName)
    .map((value) => String(value || "").trim())
    .filter((value, index, values) => isValidStoredImagePath(value) && values.indexOf(value) === index);
}
