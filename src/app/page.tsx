import Link from "next/link";

import { Badge } from "@/components/badge";
import { FlashMessage } from "@/components/flash-message";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { formatDate, formatDateTime } from "@/lib/date";
import {
  REVIEW_ACTION_LABELS,
  STATUS_LABELS,
  STATUS_STYLES,
} from "@/lib/study/constants";
import { getDashboardData } from "@/lib/study/service";
import { getSingleSearchParam } from "@/lib/utils";

type DashboardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const [params, dashboard] = await Promise.all([searchParams, getDashboardData()]);
  const message = getSingleSearchParam(params.message);
  const error = getSingleSearchParam(params.error);

  return (
    <div className="space-y-6">
      <PageHeader
        title="ダッシュボード"
        description="全体件数、今日送る問題、直近の回答ログをまとめて確認します。"
        action={
          <Link
            href="/items/new"
            className="inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            新規登録へ
          </Link>
        }
      />

      <FlashMessage message={message} error={error} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="総問題数" value={dashboard.totalCount} />
        <StatCard label="今日送信予定" value={dashboard.dueTodayCount} />
        <StatCard label="未送信件数" value={dashboard.unsentCount} />
        <StatCard label="正解数" value={dashboard.correctCount} />
        <StatCard label="不正解数" value={dashboard.incorrectCount} />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Gemini呼び出し回数" value={dashboard.geminiCallCount} />
        <StatCard label="Gemini成功回数" value={dashboard.geminiSuccessCount} />
        <StatCard label="Gemini失敗回数" value={dashboard.geminiFailureCount} />
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="LINE API呼び出し回数" value={dashboard.lineApiCallCount} />
        <StatCard label="LINE Push回数" value={dashboard.linePushCount} />
        <StatCard label="LINE Reply回数" value={dashboard.lineReplyCount} />
        <StatCard label="LINE課金対象推定通数" value={dashboard.lineEstimatedBillableCount} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">今日送る予定の問題</h2>
              <p className="text-sm text-slate-500">当日送信対象の問題を確認できます。</p>
            </div>
            <Link href="/items?today=1" className="text-sm font-semibold text-emerald-700">
              一覧で見る
            </Link>
          </div>

          <div className="space-y-3">
            {dashboard.dueTodayItems.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                本日送信対象の問題はありません。
              </p>
            ) : (
              dashboard.dueTodayItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/items/${item.id}`}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 px-4 py-4 transition hover:border-emerald-200 hover:bg-emerald-50/50"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        問題番号 {item.questionNumber}
                      </p>
                      <p className="text-sm text-slate-600">
                        {item.productName || "商品名未設定"} / {item.category || "その他"}
                      </p>
                    </div>
                    <Badge
                      label={STATUS_LABELS[item.status]}
                      className={STATUS_STYLES[item.status]}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    次回送信日: {formatDate(item.nextScheduledAt)}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)]">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-950">直近の回答ログ</h2>
            <p className="text-sm text-slate-500">LINEでの反応履歴を時系列で表示します。</p>
          </div>

          <div className="space-y-3">
            {dashboard.recentLogs.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                ログはまだありません。
              </p>
            ) : (
              dashboard.recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-slate-200 px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-slate-900">
                      {REVIEW_ACTION_LABELS[log.actionType]}
                    </p>
                    <p className="text-xs text-slate-500">{formatDateTime(log.actionAt)}</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    問題番号 {log.item.questionNumber} /{" "}
                    {log.item.productName || "商品名未設定"}
                  </p>
                  {log.rawText ? (
                    <p className="mt-2 text-xs text-slate-500">受信テキスト: {log.rawText}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)]">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-950">Gemini利用ログ</h2>
          <p className="text-sm text-slate-500">このアプリからの Gemini API 呼び出し履歴です。</p>
        </div>

        <div className="space-y-3">
          {dashboard.recentGeminiLogs.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
              Gemini API の呼び出しログはまだありません。
            </p>
          ) : (
            dashboard.recentGeminiLogs.map((log) => (
              <div key={log.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Badge
                      label={log.status === "SUCCESS" ? "成功" : "失敗"}
                      className={
                        log.status === "SUCCESS"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }
                    />
                    <p className="text-sm font-semibold text-slate-900">{log.model}</p>
                  </div>
                  <p className="text-xs text-slate-500">{formatDateTime(log.createdAt)}</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                  <span>画像: {log.imageCount}枚</span>
                  <span>入力文字数: {log.promptLength}</span>
                  <span>出力文字数: {log.responseLength ?? "-"}</span>
                  <span>利用者: {log.user?.displayName || "未設定"}</span>
                </div>
                {log.errorMessage ? (
                  <p className="mt-2 text-xs text-rose-600">エラー: {log.errorMessage}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.35)]">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-950">LINE利用ログ</h2>
          <p className="text-sm text-slate-500">このアプリからの LINE API 呼び出し履歴です。</p>
        </div>

        <div className="space-y-3">
          {dashboard.recentLineLogs.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
              LINE API の呼び出しログはまだありません。
            </p>
          ) : (
            dashboard.recentLineLogs.map((log) => (
              <div key={log.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Badge
                      label={log.status === "SUCCESS" ? "成功" : "失敗"}
                      className={
                        log.status === "SUCCESS"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }
                    />
                    <p className="text-sm font-semibold text-slate-900">{log.kind}</p>
                  </div>
                  <p className="text-xs text-slate-500">{formatDateTime(log.createdAt)}</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                  <span>メッセージ数: {log.messageCount}</span>
                  <span>課金対象推定: {log.estimatedBillableCount}</span>
                  <span>利用者: {log.user?.displayName || "未設定"}</span>
                  <span>問題番号: {log.item?.questionNumber ?? "-"}</span>
                </div>
                {log.targetLineUserId ? (
                  <p className="mt-2 text-xs text-slate-500">送信先: {log.targetLineUserId}</p>
                ) : null}
                {log.errorMessage ? (
                  <p className="mt-2 text-xs text-rose-600">エラー: {log.errorMessage}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
