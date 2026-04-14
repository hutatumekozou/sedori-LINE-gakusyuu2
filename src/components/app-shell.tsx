"use client";

import { usePathname } from "next/navigation";

import { SidebarNav } from "@/components/sidebar-nav";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return (
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-8">
        <main className="w-full max-w-md">{children}</main>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col gap-5 px-4 py-5 lg:flex-row lg:px-5">
      <aside className="w-[15rem] max-w-full lg:sticky lg:top-5 lg:h-[calc(100vh-2.5rem)] lg:w-52">
        <div className="rounded-[28px] border border-slate-200/70 bg-white/90 p-4 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.5)]">
          <div className="mb-5 space-y-2.5">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-700">
              Mercari Study
            </p>
            <div>
              <h1 className="text-base font-semibold leading-snug text-slate-950">
                メルカリ物販
                <br />
                学習問題化アプリ
              </h1>
              <p className="mt-2.5 text-[12px] leading-5 text-slate-600">
                画像と補足情報をAIで問題化し、Discord DMで毎日復習するための自分専用MVPです。
              </p>
            </div>
          </div>
          <SidebarNav />
        </div>
      </aside>

      <main className="min-w-0 flex-1 space-y-5">{children}</main>
    </div>
  );
}
