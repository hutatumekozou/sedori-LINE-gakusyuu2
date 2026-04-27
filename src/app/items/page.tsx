import Link from "next/link";
import type { ItemStatus } from "@/generated/prisma/client";

import {
  deleteStudyItemAction,
  sendNowAction,
  sendSelectedNowAction,
  updateScheduleAction,
} from "@/actions/study-item-actions";
import { AutoSendToggle } from "@/components/auto-send-toggle";
import { Badge } from "@/components/badge";
import { FavoriteToggle } from "@/components/favorite-toggle";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { formatDate, formatDateInputValue, getDaysSince } from "@/lib/date";
import {
  STUDY_CATEGORIES,
  LAST_RESULT_LABELS,
  LAST_RESULT_STYLES,
  STATUS_LABELS,
  STATUS_STYLES,
} from "@/lib/study/constants";
import { buildQuestionLabel } from "@/lib/study/messages";
import { getStudyItems } from "@/lib/study/service";
import { cn, getSingleSearchParam } from "@/lib/utils";

type ItemsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const sendModeOptions = [
  { value: "ALL", label: "送信方式: すべて" },
  { value: "AUTO", label: "自動送信" },
  { value: "MANUAL", label: "手動送信" },
] as const;

const elapsedDaysOrderOptions = [
  { value: "NONE", label: "経過日数: 既定順" },
  { value: "ASC", label: "経過日数: 昇順" },
  { value: "DESC", label: "経過日数: 降順" },
] as const;

const statusOptions: Array<{ value: ItemStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "すべて" },
  { value: "PENDING", label: "送信待ち" },
  { value: "QUESTION_SENT", label: "出題中" },
  { value: "CORRECT", label: "正解" },
  { value: "INCORRECT", label: "不正解" },
];

function renderTwoLineDate(date: Date | null) {
  if (!date) {
    return <span className="text-slate-400">-</span>;
  }

  const shortDate = formatDate(date).slice(2);
  const [yearMonth, day] = shortDate.split(/\/(?=[^/]+$)/);

  return (
    <span className="inline-flex flex-col leading-4">
      <span>{yearMonth}</span>
      <span>{day}</span>
    </span>
  );
}

function renderLastStudiedDays(date: Date | null) {
  if (!date) {
    return <span className="text-slate-400">-</span>;
  }

  const days = getDaysSince(date);

  return (
    <span className="inline-flex min-w-[3.75rem] justify-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
      {days}日
    </span>
  );
}

export default async function ItemsPage({ searchParams }: ItemsPageProps) {
  const params = await searchParams;
  const query = getSingleSearchParam(params.q) || "";
  const status = (getSingleSearchParam(params.status) || "ALL") as ItemStatus | "ALL";
  const category = getSingleSearchParam(params.category) || "ALL";
  const sendMode = (getSingleSearchParam(params.sendMode) || "ALL") as
    | "ALL"
    | "AUTO"
    | "MANUAL";
  const elapsedDaysOrder = (getSingleSearchParam(params.elapsedDaysOrder) || "NONE") as
    | "NONE"
    | "ASC"
    | "DESC";
  const favoriteOnly = getSingleSearchParam(params.favorite) === "1";
  const todayOnly = getSingleSearchParam(params.today) === "1";
  const message = getSingleSearchParam(params.message);
  const error = getSingleSearchParam(params.error);

  const items = await getStudyItems({
    query,
    status,
    category,
    sendMode,
    elapsedDaysOrder,
    favoriteOnly,
    todayOnly,
  });

  const currentSearch = new URLSearchParams();

  if (query) currentSearch.set("q", query);
  if (status && status !== "ALL") currentSearch.set("status", status);
  if (category && category !== "ALL") currentSearch.set("category", category);
  if (sendMode && sendMode !== "ALL") currentSearch.set("sendMode", sendMode);
  if (elapsedDaysOrder && elapsedDaysOrder !== "NONE") {
    currentSearch.set("elapsedDaysOrder", elapsedDaysOrder);
  }
  if (favoriteOnly) currentSearch.set("favorite", "1");
  if (todayOnly) currentSearch.set("today", "1");

  const redirectTo = currentSearch.size > 0 ? `/items?${currentSearch}` : "/items";
  const bulkSendFormId = "bulk-send-form";

  return (
    <div className="space-y-5">
      <PageHeader
        title="問題一覧"
        description="検索、絞り込み、手動送信、詳細確認をまとめて行えます。"
        action={
          <Link
            href="/items/new"
            className="inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            新規登録
          </Link>
        }
      />

      <FlashMessage message={message} error={error} />

      <form id={bulkSendFormId} action={sendSelectedNowAction}>
        <input type="hidden" name="redirectTo" value={redirectTo} />
      </form>

      <section className="rounded-[22px] border border-slate-200/70 bg-white/90 p-4 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)]">
        <div className="space-y-2.5">
          <form className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.56fr)_minmax(0,0.56fr)_minmax(0,0.62fr)_minmax(0,0.68fr)_auto_auto_auto]">
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="商品名、ブランド、カテゴリ、問題番号で検索"
              className="rounded-[18px] border border-slate-200 bg-white px-3.5 py-2 text-[12px] outline-none transition focus:border-emerald-300"
            />

            <select
              name="status"
              defaultValue={status}
              className="rounded-[18px] border border-slate-200 bg-white px-3.5 py-2 text-[12px] outline-none transition focus:border-emerald-300"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              name="category"
              defaultValue={category}
              className="rounded-[18px] border border-slate-200 bg-white px-3.5 py-2 text-[12px] outline-none transition focus:border-emerald-300"
            >
              <option value="ALL">全カテゴリ</option>
              {STUDY_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <select
              name="sendMode"
              defaultValue={sendMode}
              className="rounded-[18px] border border-slate-200 bg-white px-3.5 py-2 text-[12px] outline-none transition focus:border-emerald-300"
            >
              {sendModeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              name="elapsedDaysOrder"
              defaultValue={elapsedDaysOrder}
              className="rounded-[18px] border border-slate-200 bg-white px-3.5 py-2 text-[12px] outline-none transition focus:border-emerald-300"
            >
              {elapsedDaysOrderOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 rounded-[18px] border border-slate-200 bg-white px-3.5 py-2 text-[12px] text-slate-700">
              <input type="checkbox" name="favorite" value="1" defaultChecked={favoriteOnly} />
              お気に入りのみ
            </label>

            <label className="flex items-center gap-2 rounded-[18px] border border-slate-200 bg-white px-3.5 py-2 text-[12px] text-slate-700">
              <input type="checkbox" name="today" value="1" defaultChecked={todayOnly} />
              今日送信対象のみ
            </label>

            <button
              type="submit"
              className="rounded-[18px] bg-slate-950 px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-slate-800"
            >
              絞り込み
            </button>
          </form>

          <div className="flex justify-end">
            <button
              type="submit"
              form={bulkSendFormId}
              className="rounded-[18px] bg-slate-950 px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-slate-800"
            >
              選択した問題を一括手動送信
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-slate-200/70 bg-white/90 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)]">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="text-slate-500">
              <tr>
                <th className="sticky top-0 z-20 bg-slate-50 px-3 py-3.5 font-semibold whitespace-nowrap">選択</th>
                <th className="sticky top-0 z-20 bg-slate-50 px-2 py-3.5 font-semibold whitespace-nowrap">問題番号</th>
                <th className="sticky top-0 z-20 bg-slate-50 px-1.5 py-3.5 font-semibold whitespace-nowrap">☆</th>
                <th className="sticky top-0 z-20 bg-slate-50 px-3 py-3.5 font-semibold whitespace-nowrap">商品名</th>
                <th className="sticky top-0 z-20 bg-slate-50 px-3 py-3.5 font-semibold whitespace-nowrap">ブランド</th>
                <th className="sticky top-0 z-20 min-w-[6.5rem] bg-slate-50 px-3 py-3.5 font-semibold whitespace-nowrap">カテゴリ</th>
                <th className="sticky top-0 z-20 bg-slate-50 px-3 py-3.5 font-semibold whitespace-nowrap">自動送信</th>
                <th className="sticky top-0 z-20 bg-slate-50 px-2.5 py-3.5 font-semibold whitespace-nowrap">最終学習日</th>
                <th className="sticky top-0 z-20 bg-slate-50 px-2.5 py-3.5 font-semibold whitespace-nowrap">経過日数</th>
                <th className="sticky top-0 z-20 bg-slate-50 px-2.5 py-3.5 font-semibold whitespace-nowrap">次回送信日</th>
                <th className="sticky top-0 z-20 bg-slate-50 px-2.5 py-3.5 font-semibold whitespace-nowrap">状態</th>
                <th className="sticky top-0 z-20 bg-slate-50 px-2.5 py-3.5 font-semibold whitespace-nowrap">最終結果</th>
                <th className="sticky top-0 z-20 bg-slate-50 px-1.5 py-3.5 font-semibold whitespace-nowrap">回答数</th>
                <th className="sticky top-0 z-20 bg-slate-50 px-1.5 py-3.5 font-semibold whitespace-nowrap">正解回数</th>
                <th className="sticky top-0 z-20 bg-slate-50 px-2.5 py-3.5 font-semibold whitespace-nowrap">操作</th>
                <th className="sticky top-0 z-20 bg-slate-50 px-2.5 py-3.5 font-semibold whitespace-nowrap">作成日</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-3 py-10 text-center text-slate-500">
                    条件に一致する問題はありません。
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr id={`item-${item.id}`} key={item.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-3.5">
                      <input
                        type="checkbox"
                        name="itemIds"
                        value={item.id}
                        form={bulkSendFormId}
                        className="mt-0.5 h-4.5 w-4.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        aria-label={`問題番号${item.questionNumber}を選択`}
                      />
                    </td>
                    <td className="px-2 py-3.5 font-semibold text-slate-900">
                      <span className="block max-w-[12rem] leading-5 break-words">
                        {buildQuestionLabel(
                          {
                            questionNumber: item.questionNumber,
                            productName: item.productName,
                          },
                          { includeSentAt: false },
                        )}
                      </span>
                    </td>
                    <td className="px-1.5 py-3.5">
                      <FavoriteToggle
                        itemId={item.id}
                        questionNumber={item.questionNumber}
                        isFavorite={item.isFavorite}
                      />
                    </td>
                    <td className="px-3 py-3.5 text-slate-700">
                      <span className="block max-w-[9rem] leading-6 break-words">
                        {item.productName || "未設定"}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-slate-700">
                      <span className="block max-w-[8rem] leading-6 break-words">
                        {item.brandName || "-"}
                      </span>
                    </td>
                    <td className="min-w-[6.5rem] px-3 py-3.5 text-slate-700">
                      <span className="block max-w-[6.5rem] leading-5 break-words">
                        {item.category || "その他"}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      <AutoSendToggle itemId={item.id} autoSendEnabled={item.autoSendEnabled} />
                    </td>
                    <td className="min-w-[4.5rem] px-2.5 py-3.5 text-slate-700">
                      {renderTwoLineDate(item.lastStudiedAt)}
                    </td>
                    <td className="min-w-[4.25rem] px-2.5 py-3.5 text-slate-700">
                      {renderLastStudiedDays(item.lastStudiedAt)}
                    </td>
                    <td className="min-w-[9.5rem] px-2.5 py-3.5 text-slate-700">
                      <div className="space-y-2">
                        {renderTwoLineDate(item.nextScheduledAt)}
                        <form action={updateScheduleAction} className="space-y-1.5">
                          <input type="hidden" name="itemId" value={item.id} />
                          <input type="hidden" name="redirectTo" value={`${redirectTo}#item-${item.id}`} />
                          <input
                            type="date"
                            name="nextScheduledAt"
                            defaultValue={formatDateInputValue(item.nextScheduledAt)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] outline-none transition focus:border-emerald-300"
                            aria-label={`問題番号${item.questionNumber}の次回送信日`}
                          />
                          <SubmitButton
                            label="更新"
                            pendingLabel="更新中..."
                            variant="secondary"
                            className="w-full px-2 py-1.5 text-[11px]"
                          />
                        </form>
                      </div>
                    </td>
                    <td className="px-2.5 py-3.5 whitespace-nowrap">
                      <Badge label={STATUS_LABELS[item.status]} className={STATUS_STYLES[item.status]} />
                    </td>
                    <td className="px-2.5 py-3.5 whitespace-nowrap">
                      <span
                        className={cn(
                          "font-semibold",
                          LAST_RESULT_STYLES[item.lastResult],
                        )}
                      >
                        {LAST_RESULT_LABELS[item.lastResult]}
                      </span>
                    </td>
                    <td className="px-1.5 py-3.5 font-semibold text-slate-700 whitespace-nowrap">{item.answerCount}</td>
                    <td className="px-1.5 py-3.5 font-semibold text-slate-700 whitespace-nowrap">{item.correctCount}</td>
                    <td className="px-2.5 py-3.5">
                      <div className="grid min-w-[8.75rem] grid-cols-2 gap-1">
                        <Link
                          href={`/items/${item.id}`}
                          className="rounded-xl border border-slate-300 px-2 py-1.5 text-center text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          詳細
                        </Link>
                        <Link
                          href={`/items/${item.id}/edit`}
                          className="rounded-xl border border-slate-300 px-2 py-1.5 text-center text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          編集
                        </Link>
                        <form action={sendNowAction}>
                          <input type="hidden" name="itemId" value={item.id} />
                          <input type="hidden" name="redirectTo" value={redirectTo} />
                          <SubmitButton
                            label="手動送信"
                            pendingLabel="送信中..."
                            variant="secondary"
                            className="w-full whitespace-nowrap px-2 py-1.5 text-[11px]"
                          />
                        </form>
                        <form action={deleteStudyItemAction}>
                          <input type="hidden" name="itemId" value={item.id} />
                          <input type="hidden" name="redirectTo" value={redirectTo} />
                          <button
                            type="submit"
                            className="w-full rounded-xl border border-rose-200 px-2 py-1.5 text-center text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50"
                          >
                            削除
                          </button>
                        </form>
                      </div>
                    </td>
                    <td className="px-2.5 py-3.5 text-slate-700 whitespace-nowrap">{formatDate(item.createdAt)}</td>
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
