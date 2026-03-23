"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseDateInput } from "@/lib/date";
import { dispatchStudyItems } from "@/lib/line/service";
import {
  createStudyItem,
  deleteStudyItem,
  regenerateStudyItem,
  restoreStudyItem,
  updateAutoSendEnabled,
  updateManualSchedule,
  updateStudyItem,
} from "@/lib/study/service";
import { emptyStudyItemFormState, type StudyItemFormState } from "@/lib/study/types";
import { validateStudyItemForm, validationFailure } from "@/lib/study/validation";
import { buildRedirectUrl } from "@/lib/utils";

function revalidateAll(itemId?: number) {
  revalidatePath("/");
  revalidatePath("/items");
  revalidatePath("/items/deleted");

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
  const validated = validateStudyItemForm(formData);

  if (!validated.success) {
    return validated.state;
  }

  try {
    const item = await createStudyItem(validated.data);
    revalidateAll(item.id);
    redirect(
      `/items/${item.id}?message=${encodeURIComponent("問題を登録しました。")}`,
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
  const validated = validateStudyItemForm(formData);

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

export async function deleteStudyItemAction(formData: FormData) {
  const itemId = Number(formData.get("itemId"));
  const redirectTo = String(formData.get("redirectTo") || "/items");

  try {
    await deleteStudyItem(itemId);
    revalidateAll(itemId);
    redirect(buildRedirectUrl(redirectTo, "message", "問題を削除しました。削除済み一覧から戻せます。"));
  } catch (error) {
    redirect(
      buildRedirectUrl(
        redirectTo,
        "error",
        error instanceof Error ? error.message : "問題の削除に失敗しました。",
      ),
    );
  }
}

export async function restoreStudyItemAction(formData: FormData) {
  const itemId = Number(formData.get("itemId"));
  const redirectTo = String(formData.get("redirectTo") || "/items/deleted");

  try {
    await restoreStudyItem(itemId);
    revalidateAll(itemId);
    redirect(buildRedirectUrl(redirectTo, "message", "問題一覧に戻しました。"));
  } catch (error) {
    redirect(
      buildRedirectUrl(
        redirectTo,
        "error",
        error instanceof Error ? error.message : "問題の復元に失敗しました。",
      ),
    );
  }
}

export async function updateAutoSendEnabledAction(formData: FormData) {
  const itemId = Number(formData.get("itemId"));
  const redirectTo = String(formData.get("redirectTo") || "/items");
  const autoSendEnabled = String(formData.get("autoSendEnabled")) === "1";

  try {
    await updateAutoSendEnabled(itemId, autoSendEnabled);
    revalidateAll(itemId);
    redirect(
      buildRedirectUrl(
        redirectTo,
        "message",
        autoSendEnabled ? "自動送信を有効にしました。" : "自動送信を無効にしました。",
      ),
    );
  } catch (error) {
    redirect(
      buildRedirectUrl(
        redirectTo,
        "error",
        error instanceof Error ? error.message : "自動送信設定の更新に失敗しました。",
      ),
    );
  }
}
