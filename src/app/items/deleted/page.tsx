import { restoreStudyItemAction } from "@/actions/study-item-actions";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { formatDate, formatDateTime } from "@/lib/date";
import { getDeletedStudyItems } from "@/lib/study/service";
import { getSingleSearchParam } from "@/lib/utils";

type DeletedItemsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DeletedItemsPage({ searchParams }: DeletedItemsPageProps) {
  const params = await searchParams;
  const message = getSingleSearchParam(params.message);
  const error = getSingleSearchParam(params.error);
  const items = await getDeletedStudyItems();

  return (
    <div className="space-y-6">
      <PageHeader
        title="削除した問題"
        description="削除済みの問題を確認し、必要なら問題一覧へ戻せます。"
      />

      <FlashMessage message={message} error={error} />

      <section className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-white/90 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-4 font-semibold">問題番号</th>
                <th className="px-4 py-4 font-semibold">商品名</th>
                <th className="px-4 py-4 font-semibold">カテゴリ</th>
                <th className="px-4 py-4 font-semibold">作成日</th>
                <th className="px-4 py-4 font-semibold">削除日時</th>
                <th className="px-4 py-4 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    削除済みの問題はありません。
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-4 font-semibold text-slate-900">{item.questionNumber}</td>
                    <td className="px-4 py-4 text-slate-700">{item.productName || "未設定"}</td>
                    <td className="px-4 py-4 text-slate-700">{item.category || "その他"}</td>
                    <td className="px-4 py-4 text-slate-700">{formatDate(item.createdAt)}</td>
                    <td className="px-4 py-4 text-slate-700">{formatDateTime(item.deletedAt)}</td>
                    <td className="px-4 py-4">
                      <form action={restoreStudyItemAction} className="max-w-40">
                        <input type="hidden" name="itemId" value={item.id} />
                        <input type="hidden" name="redirectTo" value="/items/deleted" />
                        <SubmitButton
                          label="問題一覧に戻す"
                          pendingLabel="復元中..."
                          variant="secondary"
                          className="w-full text-xs"
                        />
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
