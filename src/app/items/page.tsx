import Link from "next/link";
import type { ItemStatus } from "@/generated/prisma/client";

import {
  deleteStudyItemAction,
  sendNowAction,
  updateAutoSendEnabledAction,
} from "@/actions/study-item-actions";
import { Badge } from "@/components/badge";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { formatDate } from "@/lib/date";
import {
  DIFFICULTY_LABELS,
  DIFFICULTY_STYLES,
  LAST_RESULT_LABELS,
  LAST_RESULT_STYLES,
  STATUS_LABELS,
  STATUS_STYLES,
} from "@/lib/study/constants";
import { getStudyItems } from "@/lib/study/service";
import { cn, getSingleSearchParam } from "@/lib/utils";

type ItemsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const statusOptions: Array<{ value: ItemStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "すべて" },
  { value: "PENDING", label: "送信待ち" },
  { value: "QUESTION_SENT", label: "出題中" },
  { value: "ANSWER_SHOWN", label: "解答表示済み" },
  { value: "CORRECT", label: "正解" },
  { value: "INCORRECT", label: "不正解" },
];

export default async function ItemsPage({ searchParams }: ItemsPageProps) {
  const params = await searchParams;
  const query = getSingleSearchParam(params.q) || "";
  const status = (getSingleSearchParam(params.status) || "ALL") as ItemStatus | "ALL";
  const todayOnly = getSingleSearchParam(params.today) === "1";
  const message = getSingleSearchParam(params.message);
  const error = getSingleSearchParam(params.error);

  const items = await getStudyItems({
    query,
    status,
    todayOnly,
  });

  const currentSearch = new URLSearchParams();

  if (query) currentSearch.set("q", query);
  if (status && status !== "ALL") currentSearch.set("status", status);
  if (todayOnly) currentSearch.set("today", "1");

  const redirectTo = currentSearch.size > 0 ? `/items?${currentSearch}` : "/items";

  return (
    <div className="space-y-6">
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

      <section className="rounded-[28px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)]">
        <form className="grid gap-4 lg:grid-cols-[1.5fr_0.8fr_auto_auto]">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="商品名、ブランド、問題番号で検索"
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-300"
          />

          <select
            name="status"
            defaultValue={status}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-300"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            <input type="checkbox" name="today" value="1" defaultChecked={todayOnly} />
            今日送信対象のみ
          </label>

          <button
            type="submit"
            className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            絞り込み
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-white/90 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-4 font-semibold">問題番号</th>
                <th className="px-4 py-4 font-semibold">商品名</th>
                <th className="px-4 py-4 font-semibold">ブランド名</th>
                <th className="px-4 py-4 font-semibold">自動送信</th>
                <th className="px-4 py-4 font-semibold">次回送信日</th>
                <th className="px-4 py-4 font-semibold">状態</th>
                <th className="px-4 py-4 font-semibold">難易度</th>
                <th className="px-4 py-4 font-semibold">最終結果</th>
                <th className="px-4 py-4 font-semibold">作成日</th>
                <th className="px-4 py-4 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                    条件に一致する問題はありません。
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-4 font-semibold text-slate-900">{item.questionNumber}</td>
                    <td className="px-4 py-4 text-slate-700">{item.productName || "未設定"}</td>
                    <td className="px-4 py-4 text-slate-700">{item.brandName || "未設定"}</td>
                    <td className="px-4 py-4">
                      <div className="flex min-w-28 flex-col gap-2">
                        <Badge
                          label={item.autoSendEnabled ? "ON" : "OFF"}
                          className={
                            item.autoSendEnabled
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-600"
                          }
                        />
                        <form action={updateAutoSendEnabledAction}>
                          <input type="hidden" name="itemId" value={item.id} />
                          <input type="hidden" name="redirectTo" value={redirectTo} />
                          <input
                            type="hidden"
                            name="autoSendEnabled"
                            value={item.autoSendEnabled ? "0" : "1"}
                          />
                          <SubmitButton
                            label={item.autoSendEnabled ? "無効にする" : "有効にする"}
                            pendingLabel="更新中..."
                            variant="secondary"
                            className="w-full text-xs"
                          />
                        </form>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{formatDate(item.nextScheduledAt)}</td>
                    <td className="px-4 py-4">
                      <Badge label={STATUS_LABELS[item.status]} className={STATUS_STYLES[item.status]} />
                    </td>
                    <td className="px-4 py-4">
                      <Badge
                        label={DIFFICULTY_LABELS[item.difficulty as keyof typeof DIFFICULTY_LABELS] || item.difficulty}
                        className={
                          DIFFICULTY_STYLES[item.difficulty] || "bg-slate-100 text-slate-700"
                        }
                      />
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={cn(
                          "font-semibold",
                          LAST_RESULT_STYLES[item.lastResult],
                        )}
                      >
                        {LAST_RESULT_LABELS[item.lastResult]}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{formatDate(item.createdAt)}</td>
                    <td className="px-4 py-4">
                      <div className="grid min-w-56 grid-cols-2 gap-2">
                        <Link
                          href={`/items/${item.id}`}
                          className="rounded-xl border border-slate-300 px-3 py-2 text-center text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          詳細
                        </Link>
                        <Link
                          href={`/items/${item.id}/edit`}
                          className="rounded-xl border border-slate-300 px-3 py-2 text-center text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
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
                            className="w-full whitespace-nowrap px-3 py-2 text-xs"
                          />
                        </form>
                        <form action={deleteStudyItemAction}>
                          <input type="hidden" name="itemId" value={item.id} />
                          <input type="hidden" name="redirectTo" value={redirectTo} />
                          <button
                            type="submit"
                            className="w-full rounded-xl border border-rose-200 px-3 py-2 text-center text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                          >
                            削除
                          </button>
                        </form>
                      </div>
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
