import { FlashMessage } from "@/components/flash-message";
import { getSingleSearchParam } from "@/lib/utils";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = getSingleSearchParam(params.error);
  const message = getSingleSearchParam(params.message);
  const next = getSingleSearchParam(params.next) || "/items";

  return (
    <div className="rounded-[32px] border border-slate-200/70 bg-white/95 p-6 shadow-[0_30px_90px_-50px_rgba(15,23,42,0.55)]">
      <div className="mb-6 space-y-3">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-700">
          Mercari Study
        </p>
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">パスワード入力</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            パスワードを入力すると、学習問題一覧へ進めます。
          </p>
        </div>
      </div>

      <FlashMessage message={message} error={error} />

      <form action="/api/auth/login" method="post" className="mt-5 space-y-4">
        <input type="hidden" name="next" value={next} />

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-slate-700">パスワード</span>
          <input
            type="password"
            name="password"
            required
            autoFocus
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-300"
            placeholder="パスワードを入力"
          />
        </label>

        <button
          type="submit"
          className="inline-flex w-full justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          開く
        </button>
      </form>
    </div>
  );
}
