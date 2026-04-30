"use client";

import Image from "next/image";
import {
  useActionState,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import { MAX_IMAGE_COUNT } from "@/lib/study/constants";
import { DEFAULT_STUDY_CATEGORY, STUDY_CATEGORIES } from "@/lib/study/constants";
import {
  isAllowedImageFileLike,
  type StudyImageKindValue,
} from "@/lib/study/image-upload";
import {
  emptyStudyItemFormState,
  type StudyFormImagePreview,
  type StudyItemFormDefaults,
  type StudyItemFormState,
} from "@/lib/study/types";
import { SubmitButton } from "@/components/submit-button";

type ItemFormProps = {
  action: (
    state: StudyItemFormState,
    formData: FormData,
  ) => Promise<StudyItemFormState>;
  defaults: StudyItemFormDefaults;
  submitLabel: string;
  pendingLabel: string;
  maxUploadSizeMb: number;
  imageHelpText?: string;
  currentQuestionImages?: StudyFormImagePreview[];
  currentAnswerImages?: StudyFormImagePreview[];
};

const DEFAULT_QUESTION_TEXT = "これいくらで売れた?";
const DEFAULT_ANSWER_TEXT = "売値 → ";
const SUPPORTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif";

type UploadedImageState = {
  imagePath: string;
  url: string;
  fileName: string;
  kind: StudyImageKindValue;
};

function FieldError({
  errors,
}: {
  errors?: string[];
}) {
  if (!errors?.length) {
    return null;
  }

  return <p className="text-xs text-rose-600">{errors[0]}</p>;
}

function UploadStatus({
  uploadedImages,
  pendingCount,
  onRemove,
}: {
  uploadedImages: UploadedImageState[];
  pendingCount: number;
  onRemove: (imagePath: string) => void;
}) {
  if (uploadedImages.length === 0 && pendingCount === 0) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      {pendingCount > 0 ? (
        <p className="text-xs font-semibold text-slate-600">
          画像をアップロード中です。{pendingCount}枚処理しています。
        </p>
      ) : null}
      {uploadedImages.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500">
            追加予定の画像: {uploadedImages.length}枚
          </p>
          <div className="space-y-2">
            {uploadedImages.map((image) => (
              <div
                key={image.imagePath}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <span className="truncate text-slate-600">{image.fileName}</span>
                <button
                  type="button"
                  onClick={() => onRemove(image.imagePath)}
                  className="shrink-0 rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                >
                  追加を取り消す
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SelectableImagesPreview({
  images,
  alt,
  selectedImageIds,
  onToggleImage,
}: {
  images: StudyFormImagePreview[];
  alt: string;
  selectedImageIds: number[];
  onToggleImage: (imageId: number) => void;
}) {
  if (images.length === 0) {
    return null;
  }

  const visibleImages = images.filter((image) => !selectedImageIds.includes(image.id));
  const removedImages = images.filter((image) => selectedImageIds.includes(image.id));

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-slate-500">現在の画像: {visibleImages.length}枚</p>
      {visibleImages.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {visibleImages.map((image) => {
            const originalIndex = images.findIndex((entry) => entry.id === image.id);

            return (
              <div
                key={image.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-left transition hover:border-slate-300"
              >
                <div className="relative aspect-square">
                  <Image
                    src={image.url}
                    alt={`${alt} ${originalIndex + 1}`}
                    fill
                    sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    className="object-cover transition"
                  />
                  <button
                    type="button"
                    onClick={() => onToggleImage(image.id)}
                    aria-label={`${originalIndex + 1}枚目を削除対象にする`}
                    className="absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-lg font-semibold text-slate-600 shadow-sm transition hover:bg-slate-100"
                  >
                    ×
                  </button>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-xs font-medium">
                  <span className="text-slate-500">{originalIndex + 1}枚目</span>
                  <span className="text-slate-400">残す</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-rose-200 bg-rose-50 px-4 py-6 text-sm font-medium text-rose-700">
          すべて削除予定です。保存すると現在の画像はなくなります。
        </div>
      )}

      {removedImages.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-rose-600">削除予定の画像: {removedImages.length}枚</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {removedImages.map((image) => {
              const originalIndex = images.findIndex((entry) => entry.id === image.id);

              return (
                <div
                  key={image.id}
                  className="overflow-hidden rounded-2xl border border-rose-300 bg-rose-50 text-left ring-2 ring-rose-200"
                >
                  <div className="relative aspect-square">
                    <Image
                      src={image.url}
                      alt={`${alt} ${originalIndex + 1}`}
                      fill
                      sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
                      className="object-cover opacity-45"
                    />
                    <button
                      type="button"
                      onClick={() => onToggleImage(image.id)}
                      aria-label={`${originalIndex + 1}枚目の削除を取り消す`}
                      className="absolute top-2 right-2 inline-flex min-w-14 items-center justify-center rounded-full border border-rose-300 bg-white px-3 py-1 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100"
                    >
                      戻す
                    </button>
                    <div className="absolute inset-x-0 bottom-0 bg-rose-600/90 px-3 py-2 text-xs font-semibold text-white">
                      保存時に削除
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-rose-200 px-3 py-2 text-xs font-medium">
                    <span className="text-rose-700">{originalIndex + 1}枚目</span>
                    <span className="text-rose-700">削除対象</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ItemForm({
  action,
  defaults,
  submitLabel,
  pendingLabel,
  maxUploadSizeMb,
  imageHelpText,
  currentQuestionImages = [],
  currentAnswerImages = [],
}: ItemFormProps) {
  const [state, formAction] = useActionState(action, emptyStudyItemFormState);
  const [selectedQuestionImageIds, setSelectedQuestionImageIds] = useState<number[]>([]);
  const [selectedAnswerImageIds, setSelectedAnswerImageIds] = useState<number[]>([]);
  const [uploadedQuestionImages, setUploadedQuestionImages] = useState<UploadedImageState[]>([]);
  const [uploadedAnswerImages, setUploadedAnswerImages] = useState<UploadedImageState[]>([]);
  const [questionUploadError, setQuestionUploadError] = useState<string | null>(null);
  const [answerUploadError, setAnswerUploadError] = useState<string | null>(null);
  const [questionUploadPendingCount, setQuestionUploadPendingCount] = useState(0);
  const [answerUploadPendingCount, setAnswerUploadPendingCount] = useState(0);

  useEffect(() => {
    if (state.success && state.redirectTo) {
      window.location.assign(state.redirectTo);
    }
  }, [state.redirectTo, state.success]);

  const currentQuestionImageCount =
    currentQuestionImages.length - selectedQuestionImageIds.length + uploadedQuestionImages.length;
  const currentAnswerImageCount =
    currentAnswerImages.length - selectedAnswerImageIds.length + uploadedAnswerImages.length;
  const isUploadingImages = questionUploadPendingCount > 0 || answerUploadPendingCount > 0;
  const questionImageErrors = questionUploadError
    ? [questionUploadError]
    : state.fieldErrors.questionImages;
  const answerImageErrors = answerUploadError ? [answerUploadError] : state.fieldErrors.answerImages;

  function toggleSelectedImage(
    imageId: number,
    setSelectedImageIds: Dispatch<SetStateAction<number[]>>,
  ) {
    setSelectedImageIds((currentIds) =>
      currentIds.includes(imageId)
        ? currentIds.filter((currentId) => currentId !== imageId)
        : [...currentIds, imageId],
    );
  }

  async function uploadSelectedFiles(
    files: File[],
    kind: StudyImageKindValue,
  ): Promise<UploadedImageState[]> {
    const uploadedImages: UploadedImageState[] = [];

    for (const file of files) {
      const uploadFormData = new FormData();
      uploadFormData.set("kind", kind);
      uploadFormData.set("file", file);

      const response = await fetch("/api/study-images", {
        method: "POST",
        body: uploadFormData,
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string;
            image?: UploadedImageState;
          }
        | null;

      if (!response.ok || !payload?.ok || !payload.image) {
        throw new Error(payload?.error || "画像のアップロードに失敗しました。");
      }

      uploadedImages.push(payload.image);
    }

    return uploadedImages;
  }

  async function handleImageSelection(
    event: React.ChangeEvent<HTMLInputElement>,
    kind: StudyImageKindValue,
  ) {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = "";

    if (files.length === 0) {
      return;
    }

    const setError = kind === "QUESTION" ? setQuestionUploadError : setAnswerUploadError;
    const setPendingCount =
      kind === "QUESTION" ? setQuestionUploadPendingCount : setAnswerUploadPendingCount;
    const setUploadedImages =
      kind === "QUESTION" ? setUploadedQuestionImages : setUploadedAnswerImages;
    const existingCount = kind === "QUESTION" ? currentQuestionImageCount : currentAnswerImageCount;

    setError(null);

    if (existingCount + files.length > MAX_IMAGE_COUNT) {
      setError(`画像は合計${MAX_IMAGE_COUNT}枚までです。`);
      return;
    }

    if (files.some((file) => file.size > maxUploadSizeMb * 1024 * 1024)) {
      setError(`画像サイズは1枚あたり${maxUploadSizeMb}MB以下にしてください。`);
      return;
    }

    if (files.some((file) => !isAllowedImageFileLike(file))) {
      setError("画像形式は jpeg / png / webp / gif / heic / heif に対応しています。");
      return;
    }

    setPendingCount(files.length);

    try {
      const uploadedImages = await uploadSelectedFiles(files, kind);
      setUploadedImages((currentImages) => [...currentImages, ...uploadedImages]);
    } catch (error) {
      setError(error instanceof Error ? error.message : "画像のアップロードに失敗しました。");
    } finally {
      setPendingCount(0);
    }
  }

  return (
    <form action={formAction} className="space-y-6">
      {uploadedQuestionImages.map((image) => (
        <input
          key={`uploaded-question-${image.imagePath}`}
          type="hidden"
          name="uploadedQuestionImagePaths"
          value={image.imagePath}
        />
      ))}
      {uploadedAnswerImages.map((image) => (
        <input
          key={`uploaded-answer-${image.imagePath}`}
          type="hidden"
          name="uploadedAnswerImagePaths"
          value={image.imagePath}
        />
      ))}
      {selectedQuestionImageIds.map((imageId) => (
        <input key={`remove-question-${imageId}`} type="hidden" name="removeQuestionImageIds" value={imageId} />
      ))}
      {selectedAnswerImageIds.map((imageId) => (
        <input key={`remove-answer-${imageId}`} type="hidden" name="removeAnswerImageIds" value={imageId} />
      ))}

      {state.message ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            state.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 lg:col-span-2">
          <input
            type="checkbox"
            name="autoSendEnabled"
            value="1"
            defaultChecked={defaults.autoSendEnabled ?? true}
            className="size-4 rounded border-slate-300 text-emerald-600"
          />
          自動送信を有効にする
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">商品名</span>
          <input
            name="productName"
            defaultValue={defaults.productName || ""}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-300"
            placeholder="例: COACH 二つ折り財布"
          />
          <FieldError errors={state.fieldErrors.productName} />
        </label>

        <label className="space-y-2">
          <span className="text-[13px] font-semibold text-slate-700">
            ブランド(英語大文字スペースなし)
          </span>
          <input
            name="brandName"
            defaultValue={defaults.brandName || ""}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-300"
            placeholder="例: COACH"
          />
          <FieldError errors={state.fieldErrors.brandName} />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">初回送信予定日</span>
          <input
            type="date"
            name="firstScheduledAt"
            defaultValue={defaults.firstScheduledAt}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-300"
          />
          <FieldError errors={state.fieldErrors.firstScheduledAt} />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">カテゴリ</span>
          <select
            name="category"
            defaultValue={defaults.category || DEFAULT_STUDY_CATEGORY}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-300"
          >
            {STUDY_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <FieldError errors={state.fieldErrors.category} />
        </label>
      </div>

      <label className="space-y-2">
        <span className="text-sm font-semibold text-slate-700">問題文</span>
        <textarea
          name="note"
          defaultValue={defaults.note || DEFAULT_QUESTION_TEXT}
          rows={6}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-300"
          placeholder="Discordでそのまま送る問題文を入力してください"
        />
        <FieldError errors={state.fieldErrors.note} />
      </label>

      <label className="space-y-2">
        <span className="text-sm font-semibold text-slate-700">解答</span>
        <textarea
          name="memo"
          defaultValue={defaults.memo || DEFAULT_ANSWER_TEXT}
          rows={4}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-300"
          placeholder="Discordでそのまま返す解答を入力してください"
        />
        <FieldError errors={state.fieldErrors.memo} />
      </label>

      <div className="space-y-6">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">問題文の画像</span>
          <input
            type="file"
            name="questionImages"
            accept={SUPPORTED_IMAGE_TYPES}
            multiple
            onChange={(event) => void handleImageSelection(event, "QUESTION")}
            disabled={questionUploadPendingCount > 0}
            className="block w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600"
          />
          <p className="text-xs text-slate-500">
            任意。最大{MAX_IMAGE_COUNT}枚。1枚あたり{maxUploadSizeMb}MB以下。複数枚使うときは一度にまとめて選んでください。
            {imageHelpText ? ` ${imageHelpText}` : ""}
          </p>
          <FieldError errors={questionImageErrors} />
        </label>

        <UploadStatus
          uploadedImages={uploadedQuestionImages}
          pendingCount={questionUploadPendingCount}
          onRemove={(imagePath) =>
            setUploadedQuestionImages((currentImages) =>
              currentImages.filter((image) => image.imagePath !== imagePath),
            )
          }
        />

        {currentQuestionImages.length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs text-slate-500">
                右上の×で削除対象を選んでください。保存時に選択した画像だけ削除します。
              </p>
              {selectedQuestionImageIds.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setSelectedQuestionImageIds([])}
                  className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  問題文画像の選択を解除
                </button>
              ) : null}
            </div>
            <SelectableImagesPreview
              images={currentQuestionImages}
              alt="登録済み問題文画像"
              selectedImageIds={selectedQuestionImageIds}
              onToggleImage={(imageId) => toggleSelectedImage(imageId, setSelectedQuestionImageIds)}
            />
            {selectedQuestionImageIds.length > 0 ? (
              <p className="text-xs font-semibold text-rose-600">
                保存すると選択した問題文画像を削除します。
              </p>
            ) : null}
          </div>
        ) : null}

        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">解答の画像</span>
          <input
            type="file"
            name="answerImages"
            accept={SUPPORTED_IMAGE_TYPES}
            multiple
            onChange={(event) => void handleImageSelection(event, "ANSWER")}
            disabled={answerUploadPendingCount > 0}
            className="block w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600"
          />
          <p className="text-xs text-slate-500">
            任意。最大{MAX_IMAGE_COUNT}枚。1枚あたり{maxUploadSizeMb}MB以下。複数枚使うときは一度にまとめて選んでください。
            {imageHelpText ? ` ${imageHelpText}` : ""}
          </p>
          <FieldError errors={answerImageErrors} />
        </label>

        <UploadStatus
          uploadedImages={uploadedAnswerImages}
          pendingCount={answerUploadPendingCount}
          onRemove={(imagePath) =>
            setUploadedAnswerImages((currentImages) =>
              currentImages.filter((image) => image.imagePath !== imagePath),
            )
          }
        />

        {currentAnswerImages.length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs text-slate-500">
                右上の×で削除対象を選んでください。保存時に選択した画像だけ削除します。
              </p>
              {selectedAnswerImageIds.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setSelectedAnswerImageIds([])}
                  className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  解答画像の選択を解除
                </button>
              ) : null}
            </div>
            <SelectableImagesPreview
              images={currentAnswerImages}
              alt="登録済み解答画像"
              selectedImageIds={selectedAnswerImageIds}
              onToggleImage={(imageId) => toggleSelectedImage(imageId, setSelectedAnswerImageIds)}
            />
            {selectedAnswerImageIds.length > 0 ? (
              <p className="text-xs font-semibold text-rose-600">
                保存すると選択した解答画像を削除します。
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {isUploadingImages ? (
        <p className="text-sm font-medium text-slate-600">
          画像アップロード完了後に保存できます。
        </p>
      ) : null}

      <div className="flex justify-end">
        <SubmitButton
          label={submitLabel}
          pendingLabel={pendingLabel}
          className="min-w-40"
          disabled={isUploadingImages}
        />
      </div>
    </form>
  );
}
