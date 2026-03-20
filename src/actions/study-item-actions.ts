"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseDateInput } from "@/lib/date";
import { dispatchStudyItems } from "@/lib/line/service";
import {
  createStudyItem,
  regenerateStudyItem,
  updateManualSchedule,
  updateStudyItem,
} from "@/lib/study/service";
import { emptyStudyItemFormState, type StudyItemFormState } from "@/lib/study/types";
import { validateStudyItemForm, validationFailure } from "@/lib/study/validation";
import { buildRedirectUrl } from "@/lib/utils";

function revalidateAll(itemId?: number) {
  revalidatePath("/");
  revalidatePath("/items");

  if (itemId) {
    revalidatePath(`/items/${itemId}`);
    revalidatePath(`/items/${itemId}/edit`);
  }
}

export async function createStudyItemAction(
  _prevState: StudyItemFormState = emptyStudyItemFormState,
  formData: FormData,
): Promise<StudyItemFormState> {
  void _prevState;
  const validated = validateStudyItemForm(formData, "create");

  if (!validated.success) {
    return validated.state;
  }

  try {
    const item = await createStudyItem(validated.data);
    revalidateAll(item.id);
    redirect(
      `/items/${item.id}?message=${encodeURIComponent("問題を登録し、AIによる問題生成を完了しました。")}`,
    );
  } catch (error) {
    return validationFailure(
      error instanceof Error ? error.message : "問題の登録に失敗しました。",
    );
  }
}

export async function updateStudyItemAction(
  itemId: number,
  _prevState: StudyItemFormState = emptyStudyItemFormState,
  formData: FormData,
): Promise<StudyItemFormState> {
  void _prevState;
  const validated = validateStudyItemForm(formData, "update");

  if (!validated.success) {
    return validated.state;
  }

  try {
    await updateStudyItem(itemId, validated.data);
    revalidateAll(itemId);
    redirect(`/items/${itemId}?message=${encodeURIComponent("問題を更新しました。")}`);
  } catch (error) {
    return validationFailure(
      error instanceof Error ? error.message : "問題の更新に失敗しました。",
    );
  }
}

export async function sendNowAction(formData: FormData) {
  const itemId = Number(formData.get("itemId"));
  const redirectTo = String(formData.get("redirectTo") || "/items");

  try {
    const result = await dispatchStudyItems([itemId], true);
    const failure = result.results.find((entry) => entry.status === "failed");

    revalidateAll(itemId);

    if (failure) {
      redirect(buildRedirectUrl(redirectTo, "error", failure.reason || "送信に失敗しました。"));
    }

    redirect(buildRedirectUrl(redirectTo, "message", "LINEへ出題を送信しました。"));
  } catch (error) {
    redirect(
      buildRedirectUrl(
        redirectTo,
        "error",
        error instanceof Error ? error.message : "送信に失敗しました。",
      ),
    );
  }
}

export async function regenerateStudyItemAction(formData: FormData) {
  const itemId = Number(formData.get("itemId"));
  const redirectTo = String(formData.get("redirectTo") || "/items");

  try {
    await regenerateStudyItem(itemId);
    revalidateAll(itemId);
    redirect(buildRedirectUrl(redirectTo, "message", "AIで問題を再生成しました。"));
  } catch (error) {
    redirect(
      buildRedirectUrl(
        redirectTo,
        "error",
        error instanceof Error ? error.message : "再生成に失敗しました。",
      ),
    );
  }
}

export async function updateScheduleAction(formData: FormData) {
  const itemId = Number(formData.get("itemId"));
  const redirectTo = String(formData.get("redirectTo") || "/items");
  const nextScheduledAt = String(formData.get("nextScheduledAt") || "");

  if (!nextScheduledAt) {
    redirect(buildRedirectUrl(redirectTo, "error", "次回送信日を入力してください。"));
  }

  try {
    await updateManualSchedule(itemId, parseDateInput(nextScheduledAt));
    revalidateAll(itemId);
    redirect(buildRedirectUrl(redirectTo, "message", "次回送信日を更新しました。"));
  } catch (error) {
    redirect(
      buildRedirectUrl(
        redirectTo,
        "error",
        error instanceof Error ? error.message : "次回送信日の更新に失敗しました。",
      ),
    );
  }
}
