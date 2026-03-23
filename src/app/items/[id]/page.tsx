import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";

import {
  deleteStudyItemAction,
  sendNowAction,
  updateScheduleAction,
} from "@/actions/study-item-actions";
import { Badge } from "@/components/badge";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { formatDate, formatDateInputValue, formatDateTime } from "@/lib/date";
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_STYLES,
  LAST_RESULT_LABELS,
  LAST_RESULT_STYLES,
  REVIEW_ACTION_LABELS,
  STATUS_LABELS,
  STATUS_STYLES,
} from "@/lib/study/constants";
import { getStudyItemDetail } from "@/lib/study/service";
import { cn, getSingleSearchParam } from "@/lib/utils";

type ItemDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ItemDetailPage({
  params,
  searchParams,
}: ItemDetailPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const item = await getStudyItemDetail(Number(id));

  if (!item) {
    notFound();
  }

  const message = getSingleSearchParam(query.message);
  const error = getSingleSearchParam(query.error);
  const redirectTo = `/items/${item.id}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`問題詳細 #${item.questionNumber}`}
        description="画像、問題文、解答、送信履歴、回答履歴、次回送信日を確認します。"
        action={
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/items/${item.id}/edit`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              編集
            </Link>
          </div>
        }
      />

      <FlashMessage message={message} error={error} />

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div className="rounded-[28px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)]">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Badge label={STATUS_LABELS[item.status]} className={STATUS_STYLES[item.status]} />
              <Badge
                label={DIFFICULTY_LABELS[item.difficulty as keyof typeof DIFFICULTY_LABELS] || item.difficulty}
                className={DIFFICULTY_STYLES[item.difficulty] || "bg-slate-100 text-slate-700"}
              />
              <span
                className={cn("text-sm font-semibold", LAST_RESULT_STYLES[item.lastResult])}
              >
                最終結果: {LAST_RESULT_LABELS[item.lastResult]}
              </span>
            </div>

            <h2 className="text-xl font-semibold text-slate-950">
              {item.productName || "商品名未設定"}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              ブランド: {item.brandName || "未設定"}
            </p>

            <div className="mt-6 space-y-5">
              <div>
                <p className="text-sm font-semibold text-slate-500">問題文の画像</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {item.questionImageUrls.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
                      問題文の画像はありません。
                    </p>
                  ) : (
                    item.questionImageUrls.map((image) => (
                      <Image
                        key={image.id}
                        src={image.url}
                        alt="問題文画像"
                        width={400}
                        height={400}
                        className="aspect-square rounded-2xl border border-slate-200 object-cover"
                      />
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-500">解答の画像</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {item.answerImageUrls.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
                      解答の画像はありません。
                    </p>
                  ) : (
                    item.answerImageUrls.map((image) => (
                      <Image
                        key={image.id}
                        src={image.url}
                        alt="解答画像"
                        width={400}
                        height={400}
                        className="aspect-square rounded-2xl border border-slate-200 object-cover"
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)]">
            <div className="space-y-6">
              <div>
                <p className="text-sm font-semibold text-slate-500">要約</p>
                <p className="mt-2 text-base leading-7 text-slate-800">{item.summary}</p>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-500">問題文</p>
                <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-800">
                  {item.question}
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-500">解答</p>
                <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-800">
                  {item.answer}
                </p>
              </div>

              {item.explanation && item.explanation !== item.answer ? (
                <div>
                  <p className="text-sm font-semibold text-slate-500">補足</p>
                  <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-slate-800">
                    {item.explanation}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[28px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)]">
            <h2 className="text-lg font-semibold text-slate-950">商品情報</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="font-semibold text-slate-500">問題文</dt>
                <dd className="mt-1 whitespace-pre-wrap text-slate-700">{item.note || "-"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">解答</dt>
                <dd className="mt-1 whitespace-pre-wrap text-slate-700">{item.memo || "-"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">自動送信</dt>
                <dd className="mt-1 text-slate-700">{item.autoSendEnabled ? "ON" : "OFF"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">初回送信予定日</dt>
                <dd className="mt-1 text-slate-700">{formatDate(item.firstScheduledAt)}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">次回送信日</dt>
                <dd className="mt-1 text-slate-700">{formatDate(item.nextScheduledAt)}</dd>
              </div>
            </dl>

            <div className="mt-6 space-y-3">
              <form action={sendNowAction}>
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <SubmitButton
                  label="手動送信"
                  pendingLabel="送信中..."
                  className="w-full"
                />
              </form>

              <form action={deleteStudyItemAction}>
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="redirectTo" value="/items" />
                <button
                  type="submit"
                  className="w-full rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                >
                  削除
                </button>
              </form>
            </div>

            <form action={updateScheduleAction} className="mt-6 space-y-3">
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">次回送信日の手動変更</span>
                <input
                  type="date"
                  name="nextScheduledAt"
                  defaultValue={formatDateInputValue(item.nextScheduledAt)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-300"
                />
              </label>
              <SubmitButton
                label="次回送信日を更新"
                pendingLabel="更新中..."
                variant="secondary"
                className="w-full"
              />
            </form>
          </div>

          <div className="rounded-[28px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)]">
            <h2 className="text-lg font-semibold text-slate-950">送信・回答履歴</h2>
            <div className="mt-4 space-y-3">
              {item.reviewLogs.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                  履歴はありません。
                </p>
              ) : (
                item.reviewLogs.map((log) => (
                  <div key={log.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {REVIEW_ACTION_LABELS[log.actionType]}
                      </p>
                      <p className="text-xs text-slate-500">{formatDateTime(log.actionAt)}</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      ユーザー: {log.user.displayName || log.user.lineUserId || `User ${log.userId}`}
                    </p>
                    {log.rawText ? (
                      <p className="mt-1 text-xs text-slate-500">受信テキスト: {log.rawText}</p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
