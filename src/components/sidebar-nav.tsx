"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoutButton } from "@/components/logout-button";
import { cn } from "@/lib/utils";

const navItems = [
  {
    href: "/",
    label: "ダッシュボード",
  },
  {
    href: "/items/new",
    label: "新規登録",
  },
  {
    href: "/items",
    label: "問題一覧",
  },
  {
    href: "/items/deleted",
    label: "削除した問題",
  },
  {
    href: "/rules",
    label: "アプリのルール",
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  const currentPath = pathname || "";

  return (
    <div className="space-y-4">
      <nav className="space-y-2">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? currentPath === item.href
              : item.href === "/items"
                ? currentPath === "/items" ||
                  (currentPath.startsWith("/items/") && !currentPath.startsWith("/items/deleted"))
                : currentPath === item.href || currentPath.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-2xl border px-3 py-2 text-[12px] leading-5 font-medium whitespace-normal transition",
                isActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-slate-200 bg-white/80 text-slate-700 hover:border-slate-300 hover:bg-white",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 pt-4">
        <LogoutButton />
      </div>
    </div>
  );
}
