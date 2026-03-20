import { createStudyItemAction } from "@/actions/study-item-actions";
import { ItemForm } from "@/components/item-form";
import { PageHeader } from "@/components/page-header";
import { formatDateInputValue } from "@/lib/date";
import { getAppSettings } from "@/lib/env";

export default function NewItemPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="新規登録"
        description="画像と補足情報を登録し、Geminiで学習問題を生成して保存します。"
      />

      <section className="rounded-[28px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)]">
        <ItemForm
          action={createStudyItemAction}
          defaults={{
            firstScheduledAt: formatDateInputValue(new Date()),
          }}
          submitLabel="保存して問題生成"
          pendingLabel="保存中..."
          maxUploadSizeMb={getAppSettings().maxUploadSizeMb}
        />
      </section>
    </div>
  );
}
