"use client";

import { useRef, useState } from "react";

export function LogoutButton() {
  const formRef = useRef<HTMLFormElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-left text-[12px] leading-5 font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
      >
        ログアウト
      </button>

      <form ref={formRef} action="/api/auth/logout" method="post" className="hidden" />

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4">
          <div className="w-full max-w-sm rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)]">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-950">ログアウトしますか？</p>
              <p className="text-[12px] leading-5 text-slate-500">
                ログアウトすると、もう一度パスワード入力画面に戻ります。
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                いいえ
              </button>
              <button
                type="button"
                onClick={() => formRef.current?.requestSubmit()}
                className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                はい
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
