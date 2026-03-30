import { createStudyItemAction } from "@/actions/study-item-actions";
import { ItemForm } from "@/components/item-form";
import { PageHeader } from "@/components/page-header";
import { formatDateInputValue, scheduleNextReview } from "@/lib/date";
import { getAppSettings } from "@/lib/env";
import { DEFAULT_STUDY_CATEGORY } from "@/lib/study/constants";

export default function NewItemPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="新規登録"
        description="画像と問題文・解答を登録して保存します。"
      />

      <section className="rounded-[28px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)]">
        <ItemForm
          action={createStudyItemAction}
          defaults={{
            autoSendEnabled: true,
            category: DEFAULT_STUDY_CATEGORY,
            firstScheduledAt: formatDateInputValue(scheduleNextReview(1)),
          }}
          submitLabel="保存"
          pendingLabel="保存中..."
          maxUploadSizeMb={getAppSettings().maxUploadSizeMb}
        />
      </section>
    </div>
  );
}
