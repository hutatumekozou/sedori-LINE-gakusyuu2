import type { Metadata } from "next";
import { IBM_Plex_Mono, Noto_Sans_JP } from "next/font/google";

import { SidebarNav } from "@/components/sidebar-nav";
import "./globals.css";

const notoSansJp = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "メルカリ物販 学習問題化アプリ",
  description: "画像と補足情報からAIで問題を生成し、LINEで復習できる学習支援アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${notoSansJp.variable} ${ibmPlexMono.variable} antialiased`}
      >
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_32%),linear-gradient(180deg,_#f6fbf8_0%,_#f8fafc_40%,_#eef2f7_100%)]">
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
                      画像と補足情報をAIで問題化し、LINEで毎日復習するための自分専用MVPです。
                    </p>
                  </div>
                </div>
                <SidebarNav />
              </div>
            </aside>

            <main className="min-w-0 flex-1 space-y-5">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
