"use client";

import Image from "next/image";
import { useActionState, useState } from "react";

import { MAX_IMAGE_COUNT } from "@/lib/study/constants";
import { DEFAULT_STUDY_CATEGORY, STUDY_CATEGORIES } from "@/lib/study/constants";
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
  const [removeQuestionImages, setRemoveQuestionImages] = useState(false);
  const [removeAnswerImages, setRemoveAnswerImages] = useState(false);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="removeQuestionImages" value={removeQuestionImages ? "1" : "0"} />
      <input type="hidden" name="removeAnswerImages" value={removeAnswerImages ? "1" : "0"} />

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
      </div>

      <label className="space-y-2">
        <span className="text-sm font-semibold text-slate-700">問題文</span>
        <textarea
          name="note"
          defaultValue={defaults.note || DEFAULT_QUESTION_TEXT}
          rows={6}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-300"
          placeholder="LINEでそのまま送る問題文を入力してください"
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
          placeholder="LINEでそのまま返す解答を入力してください"
        />
        <FieldError errors={state.fieldErrors.memo} />
      </label>

      <div className="space-y-6">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">問題文の画像</span>
          <input
            type="file"
            name="questionImages"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
            multiple
            className="block w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600"
          />
          <p className="text-xs text-slate-500">
            任意。最大{MAX_IMAGE_COUNT}枚。1枚あたり{maxUploadSizeMb}MB以下。
            {imageHelpText ? ` ${imageHelpText}` : ""}
          </p>
          <FieldError errors={state.fieldErrors.questionImages} />
        </label>

        {currentQuestionImages.length > 0 ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setRemoveQuestionImages((value) => !value)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                removeQuestionImages
                  ? "border-rose-300 bg-rose-50 text-rose-700"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {removeQuestionImages ? "問題文画像の削除を取り消す" : "問題文画像を削除する"}
            </button>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {currentQuestionImages.map((image) => (
                <Image
                  key={image.id}
                  src={image.url}
                  alt="登録済み問題文画像"
                  width={400}
                  height={400}
                  className={`aspect-square rounded-2xl border border-slate-200 object-cover ${
                    removeQuestionImages ? "opacity-40" : ""
                  }`}
                />
              ))}
            </div>
            {removeQuestionImages ? (
              <p className="text-xs font-semibold text-rose-600">
                保存すると現在の問題文画像を削除します。
              </p>
            ) : null}
          </div>
        ) : null}

        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">解答の画像</span>
          <input
            type="file"
            name="answerImages"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
            multiple
            className="block w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600"
          />
          <p className="text-xs text-slate-500">
            任意。最大{MAX_IMAGE_COUNT}枚。1枚あたり{maxUploadSizeMb}MB以下。
            {imageHelpText ? ` ${imageHelpText}` : ""}
          </p>
          <FieldError errors={state.fieldErrors.answerImages} />
        </label>

        {currentAnswerImages.length > 0 ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setRemoveAnswerImages((value) => !value)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                removeAnswerImages
                  ? "border-rose-300 bg-rose-50 text-rose-700"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {removeAnswerImages ? "解答画像の削除を取り消す" : "解答画像を削除する"}
            </button>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {currentAnswerImages.map((image) => (
                <Image
                  key={image.id}
                  src={image.url}
                  alt="登録済み解答画像"
                  width={400}
                  height={400}
                  className={`aspect-square rounded-2xl border border-slate-200 object-cover ${
                    removeAnswerImages ? "opacity-40" : ""
                  }`}
                />
              ))}
            </div>
            {removeAnswerImages ? (
              <p className="text-xs font-semibold text-rose-600">
                保存すると現在の解答画像を削除します。
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex justify-end">
        <SubmitButton label={submitLabel} pendingLabel={pendingLabel} className="min-w-40" />
      </div>
    </form>
  );
}
