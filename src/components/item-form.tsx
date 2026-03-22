"use client";

import Image from "next/image";
import { useActionState } from "react";

import { MAX_IMAGE_COUNT } from "@/lib/study/constants";
import {
  emptyStudyItemFormState,
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
  currentImages?: Array<{
    id: number;
    url: string;
  }>;
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

export function ItemForm({
  action,
  defaults,
  submitLabel,
  pendingLabel,
  maxUploadSizeMb,
  imageHelpText,
  currentImages = [],
}: ItemFormProps) {
  const [state, formAction] = useActionState(action, emptyStudyItemFormState);

  return (
    <form action={formAction} className="space-y-6" encType="multipart/form-data">
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
          <span className="text-sm font-semibold text-slate-700">ブランド名</span>
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
      </div>

      <label className="space-y-2">
        <span className="text-sm font-semibold text-slate-700">補足情報（問題文に反映）</span>
        <textarea
          name="note"
          defaultValue={defaults.note || ""}
          rows={6}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-300"
          placeholder="問題文にしっかり反映したい内容を入力してください。仕入れ時に見たポイント、なぜ売れたと思うか、付属品、状態、相場感など"
        />
        <FieldError errors={state.fieldErrors.note} />
      </label>

      <label className="space-y-2">
        <span className="text-sm font-semibold text-slate-700">自由メモ（解説に反映）</span>
        <textarea
          name="memo"
          defaultValue={defaults.memo || ""}
          rows={4}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-300"
          placeholder="解説に入れたい気づきや補足があれば入力してください"
        />
        <FieldError errors={state.fieldErrors.memo} />
      </label>

      <div className="space-y-3">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">画像アップロード</span>
          <input
            type="file"
            name="images"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
            multiple
            className="block w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600"
          />
          <p className="text-xs text-slate-500">
            最大{MAX_IMAGE_COUNT}枚。1枚あたり{maxUploadSizeMb}MB以下。
            {imageHelpText ? ` ${imageHelpText}` : ""}
          </p>
          <FieldError errors={state.fieldErrors.images} />
        </label>

        {currentImages.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {currentImages.map((image) => (
              <Image
                key={image.id}
                src={image.url}
                alt="登録済み画像"
                width={400}
                height={400}
                className="aspect-square rounded-2xl border border-slate-200 object-cover"
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex justify-end">
        <SubmitButton label={submitLabel} pendingLabel={pendingLabel} className="min-w-40" />
      </div>
    </form>
  );
}
