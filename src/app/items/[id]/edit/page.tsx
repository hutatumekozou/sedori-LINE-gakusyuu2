import { notFound } from "next/navigation";

import { updateStudyItemAction } from "@/actions/study-item-actions";
import { ItemForm } from "@/components/item-form";
import { PageHeader } from "@/components/page-header";
import { formatDateInputValue } from "@/lib/date";
import { getAppSettings } from "@/lib/env";
import { getStudyItemDetail } from "@/lib/study/service";

type EditItemPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditItemPage({ params }: EditItemPageProps) {
  const { id } = await params;
  const item = await getStudyItemDetail(Number(id));

  if (!item) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`問題編集 #${item.questionNumber}`}
        description="商品情報や初回送信予定日を更新できます。画像を選択すると既存画像を差し替えます。"
      />

      <section className="rounded-[28px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)]">
        <ItemForm
          action={updateStudyItemAction.bind(null, item.id)}
          defaults={{
            autoSendEnabled: item.autoSendEnabled,
            productName: item.productName,
            brandName: item.brandName,
            note: item.note,
            memo: item.memo,
            firstScheduledAt: formatDateInputValue(item.firstScheduledAt),
          }}
          submitLabel="更新する"
          pendingLabel="更新中..."
          maxUploadSizeMb={getAppSettings().maxUploadSizeMb}
          imageHelpText="画像を選択しない場合は現在の画像を保持します。"
          currentImages={item.imageUrls}
        />
      </section>
    </div>
  );
}
